/** Shared room join and leave. The database enforces the bed, money and tenancy rules. This module
 *  checks the caller and the request shape, then maps the database error code to an HTTP status. */

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  INVALID_IDEMPOTENCY_KEY: 400,
  NO_CHARACTER: 404,
  UNKNOWN_UNIT: 404,
  UNKNOWN_PROPERTY: 404,
  UNKNOWN_HOUSE: 404,
  NOT_IN_SHARED_ROOM: 404,
  ALREADY_RENTING: 409,
  UNIT_FULL: 409,
  HOUSE_INELIGIBLE: 409,
  INCOME_TOO_LOW: 409,
  RENT_TOO_HIGH: 409,
  INSUFFICIENT_FUNDS: 409,
  PAY_OVERDUE_RENT_FIRST: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store" },
  });
const failure = (code: string) => json({ error: { code } }, statusByCode[code] ?? 500);

async function authenticatedUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
}

/** The database error text starts with the stable code, e.g. "UNIT_FULL". */
function codeFrom(error: unknown) {
  // Supabase errors are plain objects with a message, not Error instances.
  const raw = (error as { message?: unknown } | null)?.message;
  const message = typeof raw === "string" ? raw : String(error);
  const code = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "INTERNAL_ERROR";
  return statusByCode[code] ? code : "INTERNAL_ERROR";
}

function requestKey(request: Request) {
  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  return uuidPattern.test(key) ? key : null;
}

export async function handleSharedHomeJoin(request: Request) {
  const userId = await authenticatedUser(request);
  if (!userId) return failure("UNAUTHORIZED");
  const key = requestKey(request);
  if (!key) return failure("INVALID_IDEMPOTENCY_KEY");
  const body: unknown = await request.json().catch(() => null);
  const unitId = (body as { unitId?: unknown } | null)?.unitId;
  if (typeof unitId !== "string" || !uuidPattern.test(unitId)) return failure("INVALID_REQUEST");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("shared_home_join", {
    p_user_id: userId,
    p_unit_id: unitId,
    p_request_id: key,
  });
  if (error) return failure(codeFrom(error));
  return json(data);
}

export async function handleSharedHomeLeave(request: Request) {
  const userId = await authenticatedUser(request);
  if (!userId) return failure("UNAUTHORIZED");
  const key = requestKey(request);
  if (!key) return failure("INVALID_IDEMPOTENCY_KEY");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("shared_home_leave", {
    p_user_id: userId,
    p_request_id: key,
  });
  if (error) return failure(codeFrom(error));
  return json(data);
}
