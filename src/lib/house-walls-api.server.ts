import {
  isRecord,
  json,
  resultCode,
  safeServerErrorCode,
  statusByCode,
} from "@/lib/house-api.server";

export type HouseWallsDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  get: (playerId: string) => Promise<unknown>;
  set: (playerId: string, closed: boolean) => Promise<unknown>;
};

export function createHouseWallsHandlers(deps: HouseWallsDependencies) {
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
      console.error("House walls API request failed", { code, message });
      return json({ error: { code } }, statusByCode[code] ?? 500);
    }
  }

  return {
    getWalls: (request: Request) => run(request, deps.get),
    postWalls: (request: Request) =>
      run(request, async (playerId) => {
        const value: unknown = await request.json().catch(() => null);
        if (!isRecord(value) || typeof value["closed"] !== "boolean")
          throw new Error("INVALID_REQUEST");
        return deps.set(playerId, value["closed"]);
      }),
  };
}

async function productionHouseWallsHandlers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
    if (error) throw new Error(error.message);
    return data;
  };
  return createHouseWallsHandlers({
    authenticate: async (request) => {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    get: (playerId) => rpc("get_house_walls", { p_player_id: playerId }),
    set: (playerId, closed) => rpc("house_set_walls", { p_player_id: playerId, p_closed: closed }),
  });
}

export async function handleHouseWallsRequest(method: "GET" | "POST", request: Request) {
  const handlers = await productionHouseWallsHandlers();
  return method === "GET" ? handlers.getWalls(request) : handlers.postWalls(request);
}
