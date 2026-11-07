import {
  isRecord,
  json,
  resultCode,
  safeServerErrorCode,
  statusByCode,
} from "@/lib/house-api.server";

export type DrawerApiDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  state: (playerId: string) => Promise<unknown>;
  store: (playerId: string, inventoryId: string) => Promise<unknown>;
  retrieve: (playerId: string, drawerId: string) => Promise<unknown>;
  equip: (playerId: string, drawerId: string) => Promise<unknown>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createDrawerApiHandlers(deps: DrawerApiDependencies) {
  async function run(request: Request, action: (playerId: string) => Promise<unknown>) {
    const playerId = await deps.authenticate(request);
    if (!playerId) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    try {
      const result = await action(playerId);
      const code = resultCode(result);
      if (code) return json({ error: { code } }, statusByCode[code] ?? 409);
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = safeServerErrorCode(message);
      console.error("Drawer API request failed", { code, message });
      return json({ error: { code } }, statusByCode[code] ?? 500);
    }
  }

  async function body(request: Request, field: string) {
    const value: unknown = await request.json().catch(() => null);
    if (!isRecord(value) || !isUuid(value[field])) throw new Error("INVALID_REQUEST");
    return value[field];
  }

  return {
    getState: (request: Request) => run(request, deps.state),
    postStore: (request: Request) =>
      run(request, async (playerId) => deps.store(playerId, await body(request, "inventoryId"))),
    postRetrieve: (request: Request) =>
      run(request, async (playerId) => deps.retrieve(playerId, await body(request, "drawerId"))),
    postEquip: (request: Request) =>
      run(request, async (playerId) => deps.equip(playerId, await body(request, "drawerId"))),
  };
}

async function productionDrawerHandlers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
    if (error) throw new Error(error.message);
    return data;
  };
  return createDrawerApiHandlers({
    authenticate: async (request) => {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    state: (playerId) => rpc("get_drawer_state", { p_player_id: playerId }),
    store: (playerId, inventoryId) =>
      rpc("drawer_store", { p_player_id: playerId, p_inventory_id: inventoryId }),
    retrieve: (playerId, drawerId) =>
      rpc("drawer_retrieve", { p_player_id: playerId, p_drawer_id: drawerId }),
    equip: (playerId, drawerId) =>
      rpc("drawer_equip", { p_player_id: playerId, p_drawer_id: drawerId }),
  });
}

export async function handleDrawerRequest(
  name: "state" | "store" | "retrieve" | "equip",
  request: Request,
) {
  const handlers = await productionDrawerHandlers();
  if (name === "state") return handlers.getState(request);
  if (name === "store") return handlers.postStore(request);
  if (name === "retrieve") return handlers.postRetrieve(request);
  return handlers.postEquip(request);
}
