import mapData from "@/data/osogbo-map.json";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";

type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  perform: (
    userId: string,
    landmarkId: string,
    actionId: string,
    requestId: string,
    action: MapPlaceAction,
  ) => Promise<unknown>;
};

export function findMapPlaceAction(landmarkId: string, actionId: string) {
  for (const district of mapData.districts) {
    const landmark = district.landmarks.find((place) => place.id === landmarkId);
    const action = landmark?.actions?.find((item) => item.id === actionId);
    if (landmark && action) return { landmark, action: action as MapPlaceAction };
  }
  return null;
}

export function createMapPlaceActionHandler(dependencies: Dependencies) {
  return async (request: Request) => {
    const userId = await dependencies.authenticate(request);
    if (!userId) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    }
    const landmarkId =
      body && typeof body === "object" && "landmarkId" in body ? body.landmarkId : null;
    const actionId = body && typeof body === "object" && "actionId" in body ? body.actionId : null;
    if (typeof landmarkId !== "string" || typeof actionId !== "string") {
      return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    }
    const found = findMapPlaceAction(landmarkId, actionId);
    if (!found) return Response.json({ error: { code: "UNKNOWN_ACTION" } }, { status: 404 });
    const requestId = request.headers.get("Idempotency-Key")?.trim();
    if (
      !requestId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ) {
      return Response.json({ error: { code: "INVALID_IDEMPOTENCY_KEY" } }, { status: 400 });
    }
    try {
      const result = await dependencies.perform(
        userId,
        landmarkId,
        actionId,
        requestId,
        found.action,
      );
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      const code = message.split(/[:\s]/, 1)[0] || "INTERNAL_ERROR";
      const known: Record<string, number> = {
        NOT_AT_PLACE: 409,
        PLACE_CLOSED: 409,
        INSUFFICIENT_FUNDS: 402,
        REQUIREMENT_NOT_MET: 409,
        COOLDOWN: 409,
        NO_CHARACTER: 404,
        NO_WALLET: 409,
        UNKNOWN_LANDMARK: 404,
        IDEMPOTENCY_CONFLICT: 409,
      };
      return Response.json({ error: { code } }, { status: known[code] ?? 500 });
    }
  };
}

export async function handleMapPlaceActionRequest(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createMapPlaceActionHandler({
    authenticate: async (incoming) => {
      const authorization = incoming.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    perform: async (userId, landmarkId, actionId, requestId, action) => {
      const { data, error } = await supabaseAdmin.rpc("perform_map_place_action", {
        p_user_id: userId,
        p_landmark_id: landmarkId,
        p_action_id: actionId,
        p_request_id: requestId,
        p_action_definition: action,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  })(request);
}
