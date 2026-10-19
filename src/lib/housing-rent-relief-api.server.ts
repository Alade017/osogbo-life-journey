const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_REQUEST: 400,
  INVALID_IDEMPOTENCY_KEY: 400,
  NO_CHARACTER: 404,
  NO_ACTIVE_HOME: 409,
  RENT_RELIEF_UNAVAILABLE: 409,
  SIDE_HUSTLE_NOT_ACTIVE: 409,
  SIDE_HUSTLE_UNAVAILABLE: 409,
  RENT_NOT_PAID: 409,
  REPOSSESSION_NOTICE_NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  ACCESSORY_BUDGET_UNAFFORDABLE: 409,
  HOUSE_LAYOUT_UNAVAILABLE: 409,
};

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

function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && key.length >= 16 && key.length <= 128 ? key : null;
}

export async function handleAccessoryBudgetRequest(request: Request) {
  const userId = await authenticatedUserId(request);
  const key = idempotencyKey(request);
  const body = (await request.json().catch(() => null)) as { budgetMinor?: unknown } | null;
  if (
    !userId ||
    !key ||
    typeof body?.budgetMinor !== "number" ||
    !Number.isSafeInteger(body.budgetMinor)
  )
    return response({ error: { code: "INVALID_REQUEST" } }, userId ? 400 : 401);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("choose_move_in_accessory_budget", {
      p_user_id: userId,
      p_budget_minor: body.budgetMinor,
      p_request_id: key,
    });
    if (error) throw new Error(error.message);
    return response(data);
  } catch (error) {
    const code = errorCode(error);
    return response({ error: { code } }, statusByCode[code] ?? 500);
  }
}

export async function handleRentReliefRequest(request: Request) {
  const userId = await authenticatedUserId(request);
  const key = idempotencyKey(request);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    hustleId?: unknown;
  } | null;
  if (!userId || !key || !body || typeof body.action !== "string")
    return response({ error: { code: "INVALID_REQUEST" } }, userId ? 400 : 401);

  const action = body.action;
  const needsHustle = action === "complete" || action === "drop" || action === "keep";
  if (
    !["apply", "complete", "drop", "keep"].includes(action) ||
    (needsHustle && typeof body.hustleId !== "string")
  )
    return response({ error: { code: "INVALID_REQUEST" } }, 400);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (action === "apply") {
      const { data, error } = await supabaseAdmin.rpc("apply_rent_relief_hustle", {
        p_user_id: userId,
        p_request_id: key,
      });
      if (error) throw new Error(error.message);
      return response(data);
    }
    if (action === "complete") {
      const { data, error } = await supabaseAdmin.rpc("complete_rent_relief_shift", {
        p_user_id: userId,
        p_hustle_id: body.hustleId as string,
        p_request_id: key,
      });
      if (error) throw new Error(error.message);
      return response(data);
    }
    if (action === "keep") {
      const rpc = supabaseAdmin.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("confirm_rent_relief_hustle", {
        p_user_id: userId,
        p_hustle_id: body.hustleId as string,
        p_request_id: key,
      });
      if (error) throw new Error(error.message);
      return response(data);
    }
    const { data, error } = await supabaseAdmin.rpc("drop_side_hustle", {
      p_user_id: userId,
      p_hustle_id: body.hustleId as string,
      p_request_id: key,
    });
    if (error) throw new Error(error.message);
    return response(data);
  } catch (error) {
    const code = errorCode(error);
    return response({ error: { code } }, statusByCode[code] ?? 500);
  }
}

export async function handleRentReliefStateRequest(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("housing_relief_state", { p_user_id: userId });
    if (error) throw new Error(error.message);
    return response(data);
  } catch (error) {
    const code = errorCode(error);
    return response({ error: { code } }, statusByCode[code] ?? 500);
  }
}

export async function handleRepossessionAcknowledgment(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
  const body = (await request.json().catch(() => null)) as { cycleId?: unknown } | null;
  if (typeof body?.cycleId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.cycleId))
    return response({ error: { code: "INVALID_REQUEST" } }, 400);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("ack_housing_repossession", {
      p_user_id: userId,
      p_cycle_id: body.cycleId,
    });
    if (error) throw new Error(error.message);
    return response(data);
  } catch (error) {
    const code = errorCode(error);
    return response({ error: { code } }, statusByCode[code] ?? 500);
  }
}
