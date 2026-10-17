import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const usernamePattern = /^[a-z0-9_]{3,24}$/;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function attemptKey(request: Request, username: string) {
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  const bytes = new TextEncoder().encode(`${address}:${username}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function passwordClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_ANON_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Authentication is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function handleUsernameAuth(request: Request, action: "register" | "login") {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return json({ error: "Invalid request." }, 400);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "Invalid request." }, 400);
  const input = body as Record<string, unknown>;
  const username =
    typeof input["username"] === "string" ? input["username"].trim().toLowerCase() : "";
  const password = input["password"];
  if (
    !usernamePattern.test(username) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 256
  )
    return json({ error: "Enter a valid username and password." }, 400);

  try {
    const { data: allowed, error: limitError } = await supabaseAdmin.rpc(
      "record_username_auth_attempt",
      { p_attempt_key: await attemptKey(request, username) },
    );
    if (limitError) throw limitError;
    if (!allowed) return json({ error: "Too many attempts. Try again later." }, 429);
    let email: string | undefined;
    if (action === "register") {
      const { data: existing } = await supabaseAdmin
        .from("username_accounts")
        .select("username")
        .eq("username", username)
        .maybeSingle();
      if (existing) return json({ error: "That username is taken." }, 409);
      // RFC-reserved example.com never receives account mail. The player can
      // replace this internal identity with a verified backup email later.
      const alias = `player-${crypto.randomUUID()}@example.com`;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: alias,
        password,
        email_confirm: true,
        user_metadata: { username },
      });
      if (error || !data.user) throw error ?? new Error("Could not create account.");
      const { error: mappingError } = await supabaseAdmin
        .from("username_accounts")
        .insert({ username, user_id: data.user.id });
      if (mappingError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        return json({ error: "That username is taken." }, 409);
      }
      email = alias;
    } else {
      const { data: mapping } = await supabaseAdmin
        .from("username_accounts")
        .select("user_id")
        .eq("username", username)
        .maybeSingle();
      if (!mapping) return json({ error: "Username or password is incorrect." }, 401);
      const { data } = await supabaseAdmin.auth.admin.getUserById(mapping.user_id);
      email = data.user?.email;
    }
    if (!email) return json({ error: "Username or password is incorrect." }, 401);
    const { data, error } = await passwordClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "Username or password is incorrect." }, 401);
    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (error) {
    console.error("Username authentication failed", error);
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("authentication is not configured") ||
      message.includes("missing supabase environment variable")
    )
      return json({ error: "Account service configuration is incomplete." }, 503);
    if (
      message.includes("record_username_auth_attempt") ||
      message.includes("username_accounts") ||
      message.includes("schema cache")
    )
      return json({ error: "Account database setup is incomplete." }, 503);
    return json({ error: "Account service is unavailable. Try again." }, 503);
  }
}
