import { supabase } from "@/integrations/supabase/client";

/** Reads the room light switch from the server. A missing value means lit. */
export function parseLightOn(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  const on = (value as Record<string, unknown>)["light_on"];
  return typeof on === "boolean" ? on : true;
}

async function authorizedHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function fetchHouseLight(): Promise<boolean> {
  const response = await fetch("/api/house/light", { headers: await authorizedHeaders() });
  if (!response.ok) throw new Error("The light could not be read.");
  return parseLightOn(await response.json().catch(() => null));
}

export async function setHouseLight(on: boolean): Promise<boolean> {
  const response = await fetch("/api/house/light", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authorizedHeaders()) },
    body: JSON.stringify({ on }),
  });
  if (!response.ok) throw new Error("The light switch was not saved.");
  return parseLightOn(await response.json().catch(() => null));
}
