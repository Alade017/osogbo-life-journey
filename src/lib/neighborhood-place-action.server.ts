import { verifyNeighborhoodInteractionAuthorization } from "../../multiplayer/interaction-authorization.ts";

type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  verifyCharacter: (userId: string, characterId: string, locationId: string) => Promise<void>;
  verifyLandmarkAction: (userId: string, landmarkId: string, actionId: string) => Promise<void>;
  perform: (userId: string, landmarkId: string, actionId: string, requestId: string) => Promise<unknown>;
  secret: () => string | undefined;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createNeighborhoodPlaceActionHandler(dependencies: Dependencies) {
  return async (request: Request) => {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    const userId = await dependencies.authenticate(request);
    if (!userId) return json({ error: { code: "UNAUTHORIZED" } }, 401);

    const requestId = request.headers.get("Idempotency-Key")?.trim() ?? "";
    const interactionToken = request.headers.get("X-Neighborhood-Authorization") ?? "";
    if (!UUID_PATTERN.test(requestId)) {
      return json({ error: { code: "INVALID_IDEMPOTENCY_KEY" } }, 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: { code: "INVALID_REQUEST" } }, 400);
    }
    const candidate =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const landmarkId = candidate?.["landmarkId"];
    const actionId = candidate?.["actionId"];
    if (
      typeof landmarkId !== "string" || !SLUG_PATTERN.test(landmarkId) ||
      typeof actionId !== "string" || !SLUG_PATTERN.test(actionId)
    ) {
      return json({ error: { code: "INVALID_REQUEST" } }, 400);
    }

    let claims;
    try {
      claims = verifyNeighborhoodInteractionAuthorization(
        interactionToken,
        { userId, landmarkId, actionId, requestId },
        dependencies.secret() ?? "",
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "INTERACTION_AUTH_INVALID";
      return json({ error: { code } }, code === "INTERACTION_AUTH_EXPIRED" ? 409 : 403);
    }

    try {
      await dependencies.verifyCharacter(userId, claims.characterId, claims.locationId);
      await dependencies.verifyLandmarkAction(userId, landmarkId, actionId);
      const result = await dependencies.perform(userId, landmarkId, actionId, requestId);
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      const code = message.split(/[\s:]/, 1)[0] || "INTERNAL_ERROR";
      const statuses: Record<string, number> = {
        AGE_RESTRICTED: 403,
        NOT_AT_PLACE: 409,
        PLACE_CLOSED: 409,
        INSUFFICIENT_FUNDS: 402,
        REQUIREMENT_NOT_MET: 409,
        COOLDOWN: 409,
        NO_CHARACTER: 404,
        NO_WALLET: 409,
        UNKNOWN_LANDMARK: 404,
        UNKNOWN_ACTION: 404,
        IDEMPOTENCY_CONFLICT: 409,
        CHARACTER_LOCATION_CHANGED: 409,
        CHARACTER_CHANGED: 409,
      };
      return json({ error: { code } }, statuses[code] ?? 500);
    }
  };
}

export async function handleNeighborhoodPlaceActionRequest(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createNeighborhoodPlaceActionHandler({
    authenticate: async (incoming) => {
      const authorization = incoming.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    secret: () => process.env["MULTIPLAYER_INTERACTION_SECRET"],
    verifyCharacter: async (userId, characterId, locationId) => {
      const { data, error } = await supabaseAdmin
        .from("characters")
        .select("id,current_location_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("INTERNAL_ERROR");
      if (!data) throw new Error("NO_CHARACTER");
      if (data.id !== characterId) throw new Error("CHARACTER_CHANGED");
      if (data.current_location_id !== locationId) throw new Error("CHARACTER_LOCATION_CHANGED");
    },
    verifyLandmarkAction: async (userId, landmarkId, actionId) => {
      const { data, error } = await supabaseAdmin.rpc("map_get_landmark_details", {
        p_user_id: userId,
        p_landmark_id: landmarkId,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("UNKNOWN_LANDMARK");
      const details = data as { actions?: Array<{ id?: string }> };
      if (!details.actions?.some((action) => action.id === actionId)) {
        throw new Error("UNKNOWN_ACTION");
      }
    },
    perform: async (userId, landmarkId, actionId, requestId) => {
      const { data, error } = await supabaseAdmin.rpc("perform_map_place_action", {
        p_user_id: userId,
        p_landmark_id: landmarkId,
        p_action_id: actionId,
        p_request_id: requestId,
        p_action_definition: {},
      });
      if (error) throw new Error(error.message);
      return data;
    },
  })(request);
}
