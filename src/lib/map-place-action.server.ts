import townData from "@/data/osogbo-town.json";
import legacyMapData from "@/data/osogbo-map.json";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";

type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  verifyAccess?: (userId: string, landmarkId: string) => Promise<void>;
  perform: (
    userId: string,
    landmarkId: string,
    actionId: string,
    requestId: string,
    action: MapPlaceAction,
  ) => Promise<unknown>;
};

export function findMapPlaceAction(landmarkId: string, actionId: string) {
  const landmark = townData.landmarks.find((place) => place.id === landmarkId);
  const action = landmark?.actions.find((item) => item.id === actionId);
  if (landmark && action) return { landmark, action: action as MapPlaceAction };
  // Keep old action ids safe for saved requests; the database now rejects their inactive pins.
  for (const district of legacyMapData.districts) {
    const oldLandmark = district.landmarks.find((place) => place.id === landmarkId);
    const oldAction = oldLandmark?.actions?.find((item) => item.id === actionId);
    if (oldLandmark && oldAction)
      return { landmark: oldLandmark, action: oldAction as MapPlaceAction };
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
      await dependencies.verifyAccess?.(userId, landmarkId);
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
        AGE_RESTRICTED: 403,
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
    verifyAccess: async (userId, landmarkId) => {
      const { data, error } = await supabaseAdmin.rpc("map_get_landmark_details", {
        p_user_id: userId,
        p_landmark_id: landmarkId,
      });
      if (error) {
        if (error.message.includes("AGE_RESTRICTED")) {
          await supabaseAdmin.rpc("map_log_age_check", {
            p_player_id: userId,
            p_landmark_id: landmarkId,
          });
          throw new Error("AGE_RESTRICTED");
        }
        throw new Error(error.message);
      }
      if (!data) throw new Error("UNKNOWN_LANDMARK");
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
