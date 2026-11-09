import { supabase } from "@/integrations/supabase/client";

/** Reads the wall setting. Null means the home keeps its default for its type. */
export function parseWallsClosed(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const closed = (value as Record<string, unknown>)["walls_closed"];
  return typeof closed === "boolean" ? closed : null;
}

async function authorizedHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function fetchHouseWalls(): Promise<boolean | null> {
  const response = await fetch("/api/house/walls", { headers: await authorizedHeaders() });
  if (!response.ok) throw new Error("The walls could not be read.");
  return parseWallsClosed(await response.json().catch(() => null));
}

export async function setHouseWalls(closed: boolean): Promise<boolean | null> {
  const response = await fetch("/api/house/walls", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authorizedHeaders()) },
    body: JSON.stringify({ closed }),
  });
  if (!response.ok) throw new Error("The wall setting was not saved.");
  return parseWallsClosed(await response.json().catch(() => null));
}
