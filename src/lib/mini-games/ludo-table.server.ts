import { newLudo, type LudoMove, type LudoMode, type LudoState } from "@/lib/mini-games/ludo";
import { applyLudoAction, type LudoAction } from "@/lib/mini-games/ludo-table-rules";

/**
 * Ludo stake table actions. The server holds the whole game and rolls the dice itself. Each action loads
 * the game, applies the rules in ludo-table-rules, and commits the new state only if the table has not
 * changed since it was read.
 */

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const failure = (code: string, status: number) => json({ error: { code } }, status);

type SeatRow = { character_id: string; user_id: string; seat: number };
type LoadedGame = {
  status: string;
  mode: LudoMode | null;
  seats: SeatRow[];
  version: number;
  state: LudoState | null;
};
type Body =
  | { tableId: string; action: "start" }
  | { tableId: string; action: "roll" }
  | { tableId: string; action: "move"; move: LudoMove };

async function authenticatedUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function parseMove(value: unknown): LudoMove | null {
  if (!value || typeof value !== "object") return null;
  const move = value as Record<string, unknown>;
  const uses = move["uses"];
  if (
    !Array.isArray(uses) ||
    uses.length < 1 ||
    uses.length > 2 ||
    !uses.every((index) => isInt(index, 0, 1))
  )
    return null;
  if (
    !isInt(move["house"], 0, 3) ||
    !isInt(move["token"], 0, 7) ||
    !isInt(move["from"], -1, 58) ||
    !isInt(move["to"], 0, 58)
  )
    return null;
  return {
    house: move["house"] as number,
    token: move["token"] as number,
    from: move["from"] as number,
    to: move["to"] as number,
    uses: uses as number[],
  };
}

function parseBody(value: unknown): Body | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body["tableId"] !== "string" || !uuidPattern.test(body["tableId"])) return null;
  const tableId = body["tableId"];
  if (body["action"] === "start") return { tableId, action: "start" };
  if (body["action"] === "roll") return { tableId, action: "roll" };
  if (body["action"] === "move") {
    const move = parseMove(body["move"]);
    return move ? { tableId, action: "move", move } : null;
  }
  return null;
}

/** Two dice from the server's random source. Players never choose them. */
function rollDice(): [number, number] {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return [(values[0]! % 6) + 1, (values[1]! % 6) + 1];
}

/** The database error text carries the stable code, e.g. "GAME_CHANGED". */
function codeFrom(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "ACTION_FAILED";
}

export async function handleLudoAction(request: Request): Promise<Response> {
  const userId = await authenticatedUser(request);
  if (!userId) return failure("UNAUTHORIZED", 401);
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return failure("BAD_REQUEST", 400);
  }
  const body = parseBody(parsed);
  if (!body) return failure("BAD_REQUEST", 400);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const loaded = await rpc("mini_game_ludo_load", { p_table: body.tableId });
  if (loaded.error) return failure(codeFrom(loaded.error), 404);
  const game = loaded.data as LoadedGame;
  const seat = game.seats.find((row) => row.user_id === userId)?.seat;
  if (!seat) return failure("NOT_SEATED", 403);
  if (game.status !== "playing") return failure("TABLE_NOT_IN_PLAY", 409);

  if (body.action === "start") {
    if (!game.state) {
      if (game.mode === null) return failure("TABLE_NOT_IN_PLAY", 409);
      const started = await rpc("mini_game_ludo_init", {
        p_table: body.tableId,
        p_state: newLudo(game.mode),
      });
      if (started.error) return failure(codeFrom(started.error), 409);
    }
    return json({ started: true });
  }

  if (!game.state) return failure("NOT_STARTED", 409);
  const action: LudoAction =
    body.action === "roll" ? { kind: "roll", dice: rollDice() } : { kind: "move", move: body.move };
  const result = applyLudoAction(game.state, seat, action);
  if (!result.ok) return failure(result.code, 422);

  const winnerSeat = result.state.winner === null ? null : result.state.winner + 1;
  const committed = await rpc("mini_game_ludo_commit", {
    p_table: body.tableId,
    p_actor_user: userId,
    p_expected_version: game.version,
    p_state: result.state,
    p_winner_seat: winnerSeat,
  });
  if (committed.error) {
    const code = codeFrom(committed.error);
    return failure(code, code === "GAME_CHANGED" ? 409 : 422);
  }
  return json({ version: committed.data });
}
