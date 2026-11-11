type HouseApiDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  state: (playerId: string) => Promise<unknown>;
  place: (playerId: string, itemId: string, slot: string) => Promise<unknown>;
  placeAt: (
    playerId: string,
    itemId: string,
    x: number,
    y: number,
    floor: 0 | 1,
  ) => Promise<unknown>;
  move: (playerId: string, fromSlot: string, x: number, y: number) => Promise<unknown>;
  rotate: (playerId: string, fromSlot: string, rotation: number) => Promise<unknown>;
  remove: (playerId: string, slot: string) => Promise<unknown>;
  equip: (playerId: string, itemId: string) => Promise<unknown>;
  unequip: (playerId: string, slot: string) => Promise<unknown>;
  buy: (playerId: string, itemId: string, idempotencyKey: string) => Promise<unknown>;
};

export const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  NOT_IN_DRAWER: 404,
  NOT_WEARABLE: 409,
  ITEM_WORN: 409,
  DRAWER_FULL: 409,
  ALREADY_OWNED: 409,
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
  INVALID_POSITION: 400,
  INSUFFICIENT_FUNDS: 409,
  IDEMPOTENCY_CONFLICT: 409,
  HOUSE_SETUP_REQUIRED: 503,
  HOUSE_SERVICE_UNAVAILABLE: 503,
};

const knownCodes = new Set(Object.keys(statusByCode));

export function safeServerErrorCode(message: string) {
  const explicit = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0];
  if (explicit && knownCodes.has(explicit)) return explicit;
  if (/schema cache|function .* does not exist|relation .* does not exist/i.test(message))
    return "HOUSE_SETUP_REQUIRED";
  return "HOUSE_SERVICE_UNAVAILABLE";
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function resultCode(value: unknown) {
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
      const code = safeServerErrorCode(message);
      console.error("House API request failed", { code, message });
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
        if (typeof value["itemId"] !== "string") throw new Error("INVALID_REQUEST");
        // Free placement: an item goes to a grid position, with no room slot.
        if (typeof value["x"] === "number" && typeof value["y"] === "number") {
          const { x, y } = { x: value["x"], y: value["y"] };
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < 4 || x > 96 || y < 4 || y > 96)
            throw new Error("INVALID_REQUEST");
          // Floor 1 is upstairs (duplex only). Anything else, or no floor, means ground.
          const floor: 0 | 1 = value["floor"] === 1 ? 1 : 0;
          return deps.placeAt(playerId, value["itemId"], x, y, floor);
        }
        if (typeof value["slot"] !== "string") throw new Error("INVALID_REQUEST");
        return deps.place(playerId, value["itemId"], value["slot"]);
      }),
    postMove: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (
          typeof value["fromSlot"] !== "string" ||
          typeof value["x"] !== "number" ||
          typeof value["y"] !== "number" ||
          !Number.isFinite(value["x"]) ||
          !Number.isFinite(value["y"]) ||
          value["x"] < 4 ||
          value["x"] > 96 ||
          value["y"] < 4 ||
          value["y"] > 96
        )
          throw new Error("INVALID_REQUEST");
        return deps.move(playerId, value["fromSlot"], value["x"], value["y"]);
      }),
    postRotate: (request: Request) =>
      run(request, async (playerId) => {
        const value = await body(request);
        if (
          typeof value["fromSlot"] !== "string" ||
          typeof value["rotation"] !== "number" ||
          !Number.isFinite(value["rotation"]) ||
          value["rotation"] < 0 ||
          value["rotation"] >= 360
        )
          throw new Error("INVALID_REQUEST");
        return deps.rotate(playerId, value["fromSlot"], value["rotation"]);
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

/** Adds the shared-room read to the house state. Non-object state is returned unchanged. */
export function withSharedHome(base: unknown, shared: unknown): unknown {
  return base && typeof base === "object" && !Array.isArray(base)
    ? { ...base, shared_home: shared }
    : base;
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
    state: async (playerId) => {
      const base = await rpc("get_house_state", { p_player_id: playerId });
      // The shared room is an extra read; a failure here must not hide the player's own home.
      let shared: unknown = null;
      try {
        shared = await rpc("shared_home_state", { p_player_id: playerId });
      } catch (error) {
        console.error("[house] shared_home_state failed", error);
      }
      return withSharedHome(base, shared);
    },
    place: (playerId, itemId, slot) =>
      rpc("house_place", { p_player_id: playerId, p_item_id: itemId, p_slot: slot }),
    placeAt: (playerId, itemId, x, y, floor) =>
      rpc("house_place_free", {
        p_player_id: playerId,
        p_item_id: itemId,
        p_x: x,
        p_y: y,
        p_floor: floor,
      }),
    move: (playerId, fromSlot, x, y) =>
      rpc("house_move_to_position", {
        p_player_id: playerId,
        p_from_slot: fromSlot,
        p_x: x,
        p_y: y,
      }),
    rotate: (playerId, fromSlot, rotation) =>
      rpc("house_rotate_placement", {
        p_player_id: playerId,
        p_from_slot: fromSlot,
        p_rotation: rotation,
      }),
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
  name: "state" | "place" | "move" | "remove" | "equip" | "unequip" | "buy" | "rotate",
  request: Request,
) {
  const handlers = await productionHandlers();
  if (name === "state") return handlers.getState(request);
  if (name === "place") return handlers.postPlace(request);
  if (name === "move") return handlers.postMove(request);
  if (name === "remove") return handlers.postRemove(request);
  if (name === "equip") return handlers.postEquip(request);
  if (name === "unequip") return handlers.postUnequip(request);
  if (name === "rotate") return handlers.postRotate(request);
  return handlers.postBuy(request);
}
