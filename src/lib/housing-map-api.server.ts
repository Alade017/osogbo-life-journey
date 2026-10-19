import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getHousingMapProperties(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(
    authorization.slice(7).trim(),
  );
  if (authError || !user.user)
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const housingRpc = supabaseAdmin.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await housingRpc("housing_map_properties", { p_user_id: user.user.id });
  if (error) {
    const code = error.message.includes("NO_CHARACTER") ? "NO_CHARACTER" : "MAP_HOMES_UNAVAILABLE";
    return Response.json({ error: { code } }, { status: code === "NO_CHARACTER" ? 404 : 503 });
  }
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
