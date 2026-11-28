const statusByCode: Record<string, number> = {
  SERVICE_UNAVAILABLE: 503,
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  NO_CHARACTER: 404,
  GIG_NOT_FOUND: 404,
  APPLICANT_NOT_FOUND: 404,
  GIG_UNAVAILABLE: 409,
  OWN_GIG: 409,
  OFFER_OUT_OF_RANGE: 400,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "INTERNAL_ERROR";
  return code in statusByCode ? code : "INTERNAL_ERROR";
}

async function authenticatedUserId(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
}

function rpcCaller() {
  return async (name: string, args: Record<string, unknown>) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };
}

/** The server cannot reach its database, usually because an environment variable is missing. */
function unavailable(error: unknown) {
  console.error("Gig Work server unavailable:", error instanceof Error ? error.message : error);
  return response({ error: { code: "SERVICE_UNAVAILABLE" } }, 503);
}

export async function handleGigBoardRequest(request: Request) {
  let userId: string | null;
  try {
    userId = await authenticatedUserId(request);
  } catch (error) {
    return unavailable(error);
  }
  if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
  try {
    return response(await rpcCaller()("gig_board", { p_user_id: userId }));
  } catch (error) {
    const code = errorCode(error);
    if (code === "INTERNAL_ERROR") console.error("Gig Work request failed:", error);
    return response({ error: { code } }, statusByCode[code] ?? 500);
  }
}

type GigBody = {
  action?: unknown;
  gigId?: unknown;
  title?: unknown;
  description?: unknown;
  pay?: unknown;
  payMax?: unknown;
  offer?: unknown;
  applicantId?: unknown;
};

export async function handleGigActionRequest(request: Request) {
  let userId: string | null;
  try {
    userId = await authenticatedUserId(request);
  } catch (error) {
    return unavailable(error);
  }
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
  const body = (await request.json().catch(() => null)) as GigBody | null;
  if (!body || !UUID.test(key)) return response({ error: { code: "INVALID_REQUEST" } }, 400);

  const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
  const isPositiveInt = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const call = rpcCaller();
  try {
    if (body.action === "post") {
      const payMax = body.payMax ?? body.pay;
      if (
        typeof body.title !== "string" ||
        typeof body.description !== "string" ||
        !isPositiveInt(body.pay) ||
        !isPositiveInt(payMax) ||
        payMax < body.pay
      )
        return response({ error: { code: "INVALID_REQUEST" } }, 400);
      return response(
        await call("gig_post", {
          p_user_id: userId,
          p_request_id: key,
          p_title: body.title,
          p_description: body.description,
          p_pay_minor: body.pay,
          p_pay_max_minor: payMax,
        }),
      );
    }
    if (!isId(body.gigId)) return response({ error: { code: "INVALID_REQUEST" } }, 400);
    if (body.action === "apply") {
      if (body.offer !== undefined && body.offer !== null && !isPositiveInt(body.offer))
        return response({ error: { code: "INVALID_REQUEST" } }, 400);
      return response(
        await call("gig_apply", {
          p_user_id: userId,
          p_request_id: key,
          p_gig_id: body.gigId,
          p_offer_minor: body.offer ?? null,
        }),
      );
    }
    if (body.action === "accept") {
      if (!isId(body.applicantId)) return response({ error: { code: "INVALID_REQUEST" } }, 400);
      return response(
        await call("gig_accept", {
          p_user_id: userId,
          p_request_id: key,
          p_gig_id: body.gigId,
          p_applicant_character_id: body.applicantId,
        }),
      );
    }
    if (body.action === "confirm" || body.action === "cancel") {
      return response(
        await call(body.action === "confirm" ? "gig_confirm_complete" : "gig_cancel", {
          p_user_id: userId,
          p_request_id: key,
          p_gig_id: body.gigId,
        }),
      );
    }
    return response({ error: { code: "INVALID_REQUEST" } }, 400);
  } catch (error) {
    const code = errorCode(error);
    if (code === "INTERNAL_ERROR") console.error("Gig Work request failed:", error);
    return response({ error: { code } }, statusByCode[code] ?? 500);
  }
}
