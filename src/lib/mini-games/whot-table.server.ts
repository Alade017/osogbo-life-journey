import { newWhot, SHAPES, type Shape, type WhotState } from "@/lib/mini-games/whot";
import { applyWhotAction, type WhotAction } from "@/lib/mini-games/whot-table-rules";

/**
 * Whot stake table actions. The server holds the whole game; each action loads it, applies the rules
 * in whot-table-rules, and commits the new state only if the table has not changed since it was read.
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
  seats: SeatRow[];
  version: number;
  state: WhotState | null;
};
type Body =
  | { tableId: string; action: "start" }
  | { tableId: string; action: "play"; cardId: string; shape?: Shape }
  | { tableId: string; action: "draw" };

async function authenticatedUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
}

function parseBody(value: unknown): Body | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body["tableId"] !== "string" || !uuidPattern.test(body["tableId"])) return null;
  const tableId = body["tableId"];
  if (body["action"] === "start") return { tableId, action: "start" };
  if (body["action"] === "draw") return { tableId, action: "draw" };
  if (
    body["action"] === "play" &&
    typeof body["cardId"] === "string" &&
    body["cardId"].length <= 40
  ) {
    const shape = body["shape"];
    if (shape !== undefined && (typeof shape !== "string" || !SHAPES.includes(shape as Shape)))
      return null;
    return {
      tableId,
      action: "play",
      cardId: body["cardId"],
      ...(shape !== undefined ? { shape: shape as Shape } : {}),
    };
  }
  return null;
}

/** The database error text carries the stable code, e.g. "GAME_CHANGED". */
function codeFrom(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "ACTION_FAILED";
}

export async function handleWhotAction(request: Request): Promise<Response> {
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

  const loaded = await rpc("mini_game_whot_load", { p_table: body.tableId });
  if (loaded.error) return failure(codeFrom(loaded.error), 404);
  const game = loaded.data as LoadedGame;
  const seat = game.seats.find((row) => row.user_id === userId)?.seat;
  if (!seat) return failure("NOT_SEATED", 403);
  if (game.status !== "playing") return failure("TABLE_NOT_IN_PLAY", 409);

  if (body.action === "start") {
    if (!game.state) {
      const first = newWhot(2);
      const started = await rpc("mini_game_whot_init", {
        p_table: body.tableId,
        p_state: first,
      });
      if (started.error) return failure(codeFrom(started.error), 409);
    }
    return json({ started: true });
  }

  if (!game.state) return failure("NOT_STARTED", 409);
  const action: WhotAction =
    body.action === "play"
      ? { kind: "play", cardId: body.cardId, ...(body.shape ? { shape: body.shape } : {}) }
      : { kind: "draw" };
  const result = applyWhotAction(game.state, seat, action);
  if (!result.ok) return failure(result.code, 422);

  const winnerSeat = result.state.winner === null ? null : result.state.winner + 1;
  const committed = await rpc("mini_game_whot_commit", {
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
