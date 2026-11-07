import {
  isRecord,
  json,
  resultCode,
  safeServerErrorCode,
  statusByCode,
} from "@/lib/house-api.server";

export type HouseLightDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  get: (playerId: string) => Promise<unknown>;
  set: (playerId: string, on: boolean) => Promise<unknown>;
};

export function createHouseLightHandlers(deps: HouseLightDependencies) {
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
      console.error("House light API request failed", { code, message });
      return json({ error: { code } }, statusByCode[code] ?? 500);
    }
  }

  return {
    getLight: (request: Request) => run(request, deps.get),
    postLight: (request: Request) =>
      run(request, async (playerId) => {
        const value: unknown = await request.json().catch(() => null);
        if (!isRecord(value) || typeof value["on"] !== "boolean")
          throw new Error("INVALID_REQUEST");
        return deps.set(playerId, value["on"]);
      }),
  };
}

async function productionHouseLightHandlers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
    if (error) throw new Error(error.message);
    return data;
  };
  return createHouseLightHandlers({
    authenticate: async (request) => {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    get: (playerId) => rpc("get_house_light", { p_player_id: playerId }),
    set: (playerId, on) => rpc("house_set_light", { p_player_id: playerId, p_on: on }),
  });
}

export async function handleHouseLightRequest(method: "GET" | "POST", request: Request) {
  const handlers = await productionHouseLightHandlers();
  return method === "GET" ? handlers.getLight(request) : handlers.postLight(request);
}
