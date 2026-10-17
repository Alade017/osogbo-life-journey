import { supabaseAdmin } from "@/integrations/supabase/client.server";

const status: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_IDEMPOTENCY_KEY: 400,
  NO_CHARACTER: 404,
  NO_WALLET: 404,
  ALREADY_TRAVELLING: 409,
  ALREADY_THERE: 409,
  TOWN_UNAVAILABLE: 404,
  INSUFFICIENT_FUNDS: 409,
};

export async function handleTownTravelRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
  if (error || !data.user)
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  const body = (await request.json().catch(() => null)) as { destination_town_id?: unknown } | null;
  if (typeof body?.destination_town_id !== "string")
    return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const { data: result, error: rpcError } = await supabaseAdmin.rpc("start_osun_town_travel", {
    p_user_id: data.user.id,
    p_destination_id: body.destination_town_id,
    p_idempotency_key: key,
  });
  if (!rpcError) return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  const code = rpcError.message.match(/\b[A-Z][A-Z_]{2,}\b/)?.[0] ?? "TOWN_TRAVEL_FAILED";
  console.error("Town travel failed", { code, message: rpcError.message });
  return Response.json({ error: { code } }, { status: status[code] ?? 500 });
}
