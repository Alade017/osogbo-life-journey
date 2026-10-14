type MapApiCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "INVALID_IDEMPOTENCY_KEY"
  | "NO_CHARACTER"
  | "AGE_RESTRICTED"
  | "INSUFFICIENT_FUNDS"
  | "ALREADY_TRAVELLING"
  | "UNKNOWN_LANDMARK"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR";

type MapApiDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  startTravel: (userId: string, landmarkId: string, idempotencyKey: string) => Promise<unknown>;
  getLandmark: (userId: string, landmarkId: string) => Promise<unknown>;
  logAgeCheck: (playerId: string, landmarkId: string) => Promise<void>;
};

const httpStatus: Record<MapApiCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  INVALID_IDEMPOTENCY_KEY: 400,
  NO_CHARACTER: 404,
  AGE_RESTRICTED: 403,
  INSUFFICIENT_FUNDS: 402,
  ALREADY_TRAVELLING: 409,
  UNKNOWN_LANDMARK: 404,
  IDEMPOTENCY_CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorCode(error: unknown): MapApiCode {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.split(/[\s:]/, 1)[0] as MapApiCode;
  return code in httpStatus ? code : "INTERNAL_ERROR";
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function createMapApiHandlers(dependencies: MapApiDependencies) {
  async function getUserId(request: Request) {
    const userId = await dependencies.authenticate(request);
    return userId;
  }

  async function logAgeDenial(userId: string, landmarkId: string) {
    try {
      await dependencies.logAgeCheck(userId, landmarkId);
    } catch (error) {
      // Keep the access denial intact if the audit insert fails, while recording
      // the failure for operational visibility without logging birth-date data.
      console.error("Map age-check audit write failed", error);
    }
  }

  return {
    async postTravel(request: Request) {
      const userId = await getUserId(request);
      if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return response({ error: { code: "INVALID_REQUEST" } }, 400);
      }
      const landmarkId =
        body && typeof body === "object" && "destination_landmark_id" in body
          ? body.destination_landmark_id
          : undefined;
      if (!validId(landmarkId)) return response({ error: { code: "UNKNOWN_LANDMARK" } }, 404);
      const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
      if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
        return response({ error: { code: "INVALID_IDEMPOTENCY_KEY" } }, 400);
      }

      try {
        const result = await dependencies.startTravel(userId, landmarkId, idempotencyKey);
        if (result && typeof result === "object" && "arrival_at" in result) {
          const payload = result as Record<string, unknown>;
          const timestamp = new Date(String(payload["arrival_at"]));
          if (!Number.isNaN(timestamp.getTime())) payload["arrival_at"] = timestamp.toISOString();
        }
        return response(result);
      } catch (error) {
        const code = errorCode(error);
        if (code === "AGE_RESTRICTED") await logAgeDenial(userId, landmarkId);
        return response({ error: { code } }, httpStatus[code]);
      }
    },

    async getLandmark(request: Request, landmarkId: string) {
      const userId = await getUserId(request);
      if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
      if (!validId(landmarkId)) return response({ error: { code: "UNKNOWN_LANDMARK" } }, 404);
      try {
        return response(await dependencies.getLandmark(userId, landmarkId));
      } catch (error) {
        const code = errorCode(error);
        if (code === "AGE_RESTRICTED") await logAgeDenial(userId, landmarkId);
        return response({ error: { code } }, httpStatus[code]);
      }
    },
  };
}

async function createProductionHandlers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createMapApiHandlers({
    authenticate: async (request) => {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const token = authorization.slice("Bearer ".length).trim();
      if (!token) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    startTravel: async (userId, landmarkId, idempotencyKey) => {
      const { data, error } = await supabaseAdmin.rpc("map_start_travel", {
        p_user_id: userId,
        p_landmark_id: landmarkId,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    getLandmark: async (userId, landmarkId) => {
      const { data, error } = await supabaseAdmin.rpc("map_get_landmark_details", {
        p_user_id: userId,
        p_landmark_id: landmarkId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    logAgeCheck: async (playerId, landmarkId) => {
      const { error } = await supabaseAdmin.rpc("map_log_age_check", {
        p_player_id: playerId,
        p_landmark_id: landmarkId,
      });
      if (error) throw new Error(error.message);
    },
  });
}

export async function handleMapTravelRequest(request: Request) {
  return (await createProductionHandlers()).postTravel(request);
}

export async function handleMapLandmarkRequest(request: Request, id: string) {
  return (await createProductionHandlers()).getLandmark(request, id);
}
