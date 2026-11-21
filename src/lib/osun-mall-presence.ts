import { supabase } from "@/integrations/supabase/client";

export type MallZone = "mall" | "street";

/**
 * How often a visitor on the street reports in. The server only accepts a report from the last
 * 30 seconds for ordering a ride, so this must stay well inside that window.
 */
export const PRESENCE_HEARTBEAT_MS = 10_000;
export const PRESENCE_WINDOW_MS = 30_000;

/** Tells the server where the visitor is. Rides can only be ordered from a recent street report. */
export async function reportMallZone(zone: MallZone) {
  const { error } = await supabase.rpc("set_osun_mall_presence", { p_zone: zone });
  if (error) throw error;
}
