type HousingApiDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  eligible: (userId: string) => Promise<unknown>;
  choose: (userId: string, houseTypeId: string, key: string) => Promise<unknown>;
  rent: (userId: string, houseTypeId: string, key: string) => Promise<unknown>;
  defer: (userId: string) => Promise<unknown>;
  home: (userId: string) => Promise<unknown>;
  mutateItem: (userId: string, payload: Record<string, unknown>) => Promise<unknown>;
};

const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  INVALID_IDEMPOTENCY_KEY: 400,
  NO_CHARACTER: 404,
  UNKNOWN_HOUSE: 404,
  ALREADY_RENTING: 409,
  HOUSE_INELIGIBLE: 409,
  INSUFFICIENT_FUNDS: 409,
  INCOME_TOO_LOW: 409,
  RENT_TOO_HIGH: 409,
  IDEMPOTENCY_CONFLICT: 409,
  HOUSING_NOT_PENDING: 409,
  NO_HOME: 404,
  NOT_OWNED: 403,
  ITEM_NOT_WEARABLE: 409,
  UNKNOWN_ITEM: 404,
  SLOT_MISMATCH: 409,
};

const reasonByCode: Record<string, string> = {
  INSUFFICIENT_FUNDS:
    "The deposit and first week’s rent are more than your available wallet balance.",
  INCOME_TOO_LOW: "This home needs more weekly income or additional income sources.",
  UNKNOWN_HOUSE: "This home is no longer available. Refresh the list and choose another.",
  IDEMPOTENCY_CONFLICT: "This rent request key was already used for a different home.",
  ALREADY_RENTING: "You already have an active rental.",
  HOUSE_INELIGIBLE: "You do not meet the requirements for this home.",
};

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.split(/[\s:]/, 1)[0] ?? "INTERNAL_ERROR";
  return statusByCode[code] ? code : "INTERNAL_ERROR";
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function validBody(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createHousingApiHandlers(deps: HousingApiDependencies) {
  async function withUser(request: Request, run: (userId: string) => Promise<unknown>) {
    const userId = await deps.authenticate(request);
    if (!userId) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    try {
      return json(await run(userId));
    } catch (error) {
      const code = errorCode(error);
      return json(
        { error: { code, reason: reasonByCode[code] ?? code.replaceAll("_", " ").toLowerCase() } },
        statusByCode[code] ?? 500,
      );
    }
  }
  return {
    getEligible: (request: Request) => withUser(request, deps.eligible),
    postChoose: (request: Request) =>
      withUser(request, async (userId) => {
        const body: unknown = await request.json().catch(() => null);
        if (!validBody(body) || typeof body["house_type_id"] !== "string")
          throw new Error("INVALID_REQUEST");
        const key = request.headers.get("Idempotency-Key")?.trim();
        if (!key || key.length < 16 || key.length > 128) throw new Error("INVALID_IDEMPOTENCY_KEY");
        return deps.choose(userId, body["house_type_id"] as string, key);
      }),
    postRent: (request: Request) =>
      withUser(request, async (userId) => {
        const body: unknown = await request.json().catch(() => null);
        if (!validBody(body) || typeof body["house_type_id"] !== "string")
          throw new Error("INVALID_REQUEST");
        const key = request.headers.get("Idempotency-Key")?.trim();
        if (!key || key.length < 16 || key.length > 128) throw new Error("INVALID_IDEMPOTENCY_KEY");
        return deps.rent(userId, body["house_type_id"] as string, key);
      }),
    postDefer: (request: Request) => withUser(request, deps.defer),
    getHome: (request: Request) => withUser(request, deps.home),
    postItem: (request: Request, forcedAction?: "place" | "remove" | "equip" | "unequip") =>
      withUser(request, async (userId) => {
        const body: unknown = await request.json().catch(() => null);
        const action = forcedAction ?? (validBody(body) ? body["action"] : null);
        if (
          !validBody(body) ||
          !["place", "remove", "equip", "unequip"].includes(String(action)) ||
          typeof body["item_id"] !== "string"
        )
          throw new Error("INVALID_REQUEST");
        const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
        if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128)
          throw new Error("INVALID_IDEMPOTENCY_KEY");
        return deps.mutateItem(userId, { ...body, action, idempotency_key: idempotencyKey });
      }),
  };
}

async function productionHandlers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createHousingApiHandlers({
    authenticate: async (request) => {
      const auth = request.headers.get("authorization");
      if (!auth?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    eligible: async (userId) => {
      const { data, error } = await supabaseAdmin.rpc("housing_eligible_houses", {
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    choose: async (userId, houseTypeId, key) => {
      const { data, error } = await supabaseAdmin.rpc("housing_choose", {
        p_user_id: userId,
        p_house_type_id: houseTypeId,
        p_idempotency_key: key,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    rent: async (userId, houseTypeId, key) => {
      const { data, error } = await supabaseAdmin.rpc("housing_rent", {
        p_user_id: userId,
        p_house_type_id: houseTypeId,
        p_idempotency_key: key,
      });
      if (error) throw new Error(error.message);
      if (data && typeof data === "object" && "ok" in data && data["ok"] === false) {
        throw new Error(String("code" in data ? data["code"] : "HOUSE_INELIGIBLE"));
      }
      return data;
    },
    defer: async (userId) => {
      const { data, error } = await supabaseAdmin.rpc("housing_defer", { p_user_id: userId });
      if (error) throw new Error(error.message);
      return data;
    },
    home: async (userId) => {
      const { data: character, error: characterError } = await supabaseAdmin
        .from("characters")
        .select("id,onboarding_step")
        .eq("user_id", userId)
        .maybeSingle();
      if (characterError) throw new Error(characterError.message);
      if (!character) throw new Error("NO_CHARACTER");
      const { data: home, error } = await supabaseAdmin
        .from("player_homes")
        .select(
          "id,house_type_id,moved_in_at,next_rent_at,house_types(id,label,bedrooms,kitchen_access,bathroom_access,monthly_rent,deposit,weekly_rent_minor,asset_key,slots)",
        )
        .eq("character_id", character.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const { data: items, error: itemsError } = await supabaseAdmin
        .from("home_items")
        .select("id,item_id,slot_type,slot_id,x,y,z,placed,equipped,updated_at")
        .eq("character_id", character.id)
        .order("z");
      if (itemsError) throw new Error(itemsError.message);
      return { onboarding_step: character.onboarding_step, home, home_items: items ?? [] };
    },
    mutateItem: async (userId, payload) => {
      const { data, error } = await supabaseAdmin.rpc("home_item_mutate", {
        p_user_id: userId,
        p_action: String(payload["action"]),
        p_item_id: String(payload["item_id"]),
        p_idempotency_key: String(payload["idempotency_key"]),
        p_slot_id: typeof payload["slot_id"] === "string" ? payload["slot_id"] : null,
        p_x: typeof payload["x"] === "number" ? payload["x"] : 50,
        p_y: typeof payload["y"] === "number" ? payload["y"] : 50,
      });
      if (error) throw new Error(error.message);
      return { home_items: data };
    },
  });
}

export async function handleHousingRequest(
  name:
    | "eligible"
    | "choose"
    | "rent"
    | "defer"
    | "home"
    | "item"
    | "place"
    | "remove"
    | "equip"
    | "unequip",
  request: Request,
) {
  const handlers = await productionHandlers();
  if (name === "eligible") return handlers.getEligible(request);
  if (name === "choose") return handlers.postChoose(request);
  if (name === "rent") return handlers.postRent(request);
  if (name === "defer") return handlers.postDefer(request);
  if (name === "home") return handlers.getHome(request);
  return handlers.postItem(request, name === "item" ? undefined : name);
}
