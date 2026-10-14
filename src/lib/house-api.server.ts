type HouseApiDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  state: (playerId: string) => Promise<unknown>;
  place: (playerId: string, itemId: string, slot: string) => Promise<unknown>;
  remove: (playerId: string, slot: string) => Promise<unknown>;
  equip: (playerId: string, itemId: string) => Promise<unknown>;
  unequip: (playerId: string, slot: string) => Promise<unknown>;
  buy: (playerId: string, itemId: string, idempotencyKey: string) => Promise<unknown>;
};

const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  INVALID_IDEMPOTENCY_KEY: 400,
  UNKNOWN_ITEM: 404,
  NO_CHARACTER: 404,
  NO_WALLET: 404,
  NO_ACTIVE_HOUSE: 409,
  NOT_OWNED: 403,
  SLOT_MISMATCH: 409,
  SLOT_OCCUPIED: 409,
  EMPTY_SLOT: 404,
  NOT_EQUIPPABLE: 409,
  INVALID_SLOT: 400,
  INSUFFICIENT_FUNDS: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resultCode(value: unknown) {
  if (isRecord(value) && value["ok"] === false && typeof value["code"] === "string") {
    return value["code"];
  }
  return null;
}

export function createHouseApiHandlers(deps: HouseApiDependencies) {
  async function run(request: Request, action: (playerId: string) => Promise<unknown>) {
    const playerId = await deps.authenticate(request);
    if (!playerId) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    try {
      const result = await action(playerId);
      const code = resultCode(result);
      if (code) {
        return json({ error: { code } }, statusByCode[code] ?? 409);
      }
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.split(/[\s:]/, 1)[0] ?? "INTERNAL_ERROR";
      return json({ error: { code } }, statusByCode[code] ?? 500);
    }
  }

  async function body(request: Request) {
    const value: unknown = await request.json().catch(() => null);
    if (!isRecord(value)) throw new Error("INVALID_REQUEST");
    return value;
  }

  return {
    getState: (request: Request) => run(request, deps.state),
    postPlace: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (typeof value["itemId"] !== "string" || typeof value["slot"] !== "string")
          throw new Error("INVALID_REQUEST");
        return deps.place(playerId, value["itemId"], value["slot"]);
      }),
    postRemove: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (typeof value["slot"] !== "string") throw new Error("INVALID_REQUEST");
        return deps.remove(playerId, value["slot"]);
      }),
    postEquip: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (typeof value["itemId"] !== "string") throw new Error("INVALID_REQUEST");
        return deps.equip(playerId, value["itemId"]);
      }),
    postUnequip: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (typeof value["slot"] !== "string") throw new Error("INVALID_REQUEST");
        return deps.unequip(playerId, value["slot"]);
      }),
    postBuy: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (typeof value["itemId"] !== "string") throw new Error("INVALID_REQUEST");
        const key = request.headers.get("Idempotency-Key")?.trim();
        if (!key || key.length < 16 || key.length > 128) throw new Error("INVALID_IDEMPOTENCY_KEY");
        return deps.buy(playerId, value["itemId"], key);
      }),
  };
}

async function productionHandlers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
    if (error) throw new Error(error.message);
    return data;
  };
  return createHouseApiHandlers({
    authenticate: async (request) => {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    state: (playerId) => rpc("get_house_state", { p_player_id: playerId }),
    place: (playerId, itemId, slot) =>
      rpc("house_place", { p_player_id: playerId, p_item_id: itemId, p_slot: slot }),
    remove: (playerId, slot) => rpc("house_remove", { p_player_id: playerId, p_slot: slot }),
    equip: (playerId, itemId) => rpc("outfit_equip", { p_player_id: playerId, p_item_id: itemId }),
    unequip: (playerId, slot) => rpc("outfit_unequip", { p_player_id: playerId, p_slot: slot }),
    buy: (playerId, itemId, idempotencyKey) =>
      rpc("shop_buy", {
        p_player_id: playerId,
        p_item_id: itemId,
        p_idempotency_key: idempotencyKey,
      }),
  });
}

export async function handleHouseRequest(
  name: "state" | "place" | "remove" | "equip" | "unequip" | "buy",
  request: Request,
) {
  const handlers = await productionHandlers();
  if (name === "state") return handlers.getState(request);
  if (name === "place") return handlers.postPlace(request);
  if (name === "remove") return handlers.postRemove(request);
  if (name === "equip") return handlers.postEquip(request);
  if (name === "unequip") return handlers.postUnequip(request);
  return handlers.postBuy(request);
}
