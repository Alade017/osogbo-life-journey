import { supabase } from "@/integrations/supabase/client";
import { parseSimulationSnapshot, type SimulationSnapshot } from "@/lib/simulation-service";
import type { Json } from "@/integrations/supabase/types";
export type CatalogActivityCompletion = {
  id: string; slug: string; name: string; category: string; duration_minutes: number;
  cooldown_minutes: number; xp_reward: number; energy_delta: number; hunger_delta: number;
  thirst_delta: number; configured_rewards: Json; completed_at: string; cooldown_ends_at: string | null;
};
export type CatalogActivityResult = { snapshot: SimulationSnapshot; activity: CatalogActivityCompletion; duplicate: boolean };
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function parseCatalogActivityResult(value: unknown): CatalogActivityResult {
  if (!isRecord(value) || !isRecord(value.activity)) throw new Error("The server returned an invalid activity completion.");
  const a = value.activity;
  if (typeof a.id !== "string" || typeof a.slug !== "string" || typeof a.name !== "string" ||
    typeof a.category !== "string" || !Number.isInteger(a.duration_minutes) ||
    !Number.isInteger(a.cooldown_minutes) || !Number.isInteger(a.xp_reward) ||
    !Number.isInteger(a.energy_delta) || !Number.isInteger(a.hunger_delta) ||
    !Number.isInteger(a.thirst_delta) || typeof a.completed_at !== "string" ||
    (a.cooldown_ends_at !== null && typeof a.cooldown_ends_at !== "string") ||
    typeof value.duplicate !== "boolean") throw new Error("The server returned incomplete activity completion data.");
  return { snapshot: parseSimulationSnapshot(value.snapshot), activity: a as unknown as CatalogActivityCompletion, duplicate: value.duplicate };
}
export async function performCatalogActivity(args: { session: string; revision: number; activitySlug: string; requestId: string }): Promise<CatalogActivityResult> {
  const { data, error } = await supabase.rpc("perform_catalog_activity", {
    p_session: args.session, p_revision: args.revision, p_activity_slug: args.activitySlug, p_request_id: args.requestId,
  });
  if (error) throw new Error(error.message);
  return parseCatalogActivityResult(data);
}
