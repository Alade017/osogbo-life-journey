import townData from "@/data/osogbo-town.json";
import legacyMapData from "@/data/osogbo-map.json";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";

type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  verifyAccess?: (userId: string, landmarkId: string, actionId: string) => Promise<void>;
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
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(landmarkId) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(actionId)
    )
      return Response.json({ error: { code: "UNKNOWN_ACTION" } }, { status: 404 });
    if (!dependencies.verifyAccess && !findMapPlaceAction(landmarkId, actionId))
      return Response.json({ error: { code: "UNKNOWN_ACTION" } }, { status: 404 });
    const requestId = request.headers.get("Idempotency-Key")?.trim();
    if (
      !requestId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ) {
      return Response.json({ error: { code: "INVALID_IDEMPOTENCY_KEY" } }, { status: 400 });
    }
    try {
      await dependencies.verifyAccess?.(userId, landmarkId, actionId);
      const result = await dependencies.perform(
        userId,
        landmarkId,
        actionId,
        requestId,
        findMapPlaceAction(landmarkId, actionId)?.action ?? ({ id: actionId } as MapPlaceAction),
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
        UNKNOWN_ACTION: 404,
        IDEMPOTENCY_CONFLICT: 409,
      };
      return Response.json({ error: { code } }, { status: known[code] ?? 500 });
    }
  };
}

export async function handleMapPlaceActionRequest(request: Request) {
  if (!request.headers.has("X-Neighborhood-Authorization")) {
    return Response.json(
      { error: { code: "NEIGHBORHOOD_AUTHORIZATION_REQUIRED" } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { handleNeighborhoodPlaceActionRequest } =
    await import("@/lib/neighborhood-place-action.server");
  return handleNeighborhoodPlaceActionRequest(request);
}
