import { supabase } from "@/integrations/supabase/client";

/** Calls a housing API route with the player's session, and returns the parsed body. */
export async function housingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in again to see properties.");
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "reason" in body.error &&
      typeof body.error.reason === "string"
        ? body.error.reason
        : "The property service is unavailable. Try again.";
    throw new Error(reason);
  }
  return body as T;
}
