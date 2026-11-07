import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  parseSimulationSnapshot,
  type SimulationSnapshot,
} from "@/lib/simulation-service";

export type CatalogActivityCompletion = {
  id: string;
  slug: string;
  name: string;
  category: string;
  duration_minutes: number;
  cooldown_minutes: number;
  xp_reward: number;
  energy_delta: number;
  hunger_delta: number;
  thirst_delta: number;
  configured_rewards: Json;
  completed_at: string;
  cooldown_ends_at: string | null;
};

export type CatalogActivityResult = {
  snapshot: SimulationSnapshot;
  activity: CatalogActivityCompletion;
  duplicate: boolean;
};


const EXPECTED_ACTIVITY_REJECTION =
  /^(?:This activity|Travel to |Requires |Resume your personal simulation|Finish or interrupt|That home activity|Request ID belongs|Invalid activity request)/i;

export function isExpectedActivityRejection(message: string): boolean {
  return EXPECTED_ACTIVITY_REJECTION.test(message.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseCatalogActivityResult(value: unknown): CatalogActivityResult {
  if (!isRecord(value) || !isRecord(value["activity"])) {
    throw new Error("The server returned an invalid activity completion.");
  }

  const activity = value["activity"];
  if (
    typeof activity["id"] !== "string" ||
    typeof activity["slug"] !== "string" ||
    typeof activity["name"] !== "string" ||
    typeof activity["category"] !== "string" ||
    !Number.isInteger(activity["duration_minutes"]) ||
    Number(activity["duration_minutes"]) < 1 ||
    Number(activity["duration_minutes"]) > 1440 ||
    !Number.isInteger(activity["cooldown_minutes"]) ||
    Number(activity["cooldown_minutes"]) < 0 ||
    !Number.isInteger(activity["xp_reward"]) ||
    Number(activity["xp_reward"]) < 0 ||
    !Number.isInteger(activity["energy_delta"]) ||
    Number(activity["energy_delta"]) < -100 ||
    Number(activity["energy_delta"]) > 100 ||
    !Number.isInteger(activity["hunger_delta"]) ||
    Number(activity["hunger_delta"]) < -100 ||
    Number(activity["hunger_delta"]) > 100 ||
    !Number.isInteger(activity["thirst_delta"]) ||
    Number(activity["thirst_delta"]) < -100 ||
    Number(activity["thirst_delta"]) > 100 ||
    typeof activity["completed_at"] !== "string" ||
    (activity["cooldown_ends_at"] !== null && typeof activity["cooldown_ends_at"] !== "string") ||
    typeof value["duplicate"] !== "boolean"
  ) {
    throw new Error("The server returned incomplete activity completion data.");
  }

  return {
    snapshot: parseSimulationSnapshot(value["snapshot"]),
    activity: activity as unknown as CatalogActivityCompletion,
    duplicate: value["duplicate"],
  };
}

export async function performCatalogActivity(args: {
  session: string;
  revision: number;
  activitySlug: string;
  requestId: string;
}): Promise<CatalogActivityResult> {
  const { data, error } = await supabase.rpc("perform_catalog_activity", {
    p_session: args.session,
    p_revision: args.revision,
    p_activity_slug: args.activitySlug,
    p_request_id: args.requestId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = parseCatalogActivityResult(data);
  if (result.activity["slug"] !== args.activitySlug) {
    throw new Error("The server completed a different catalogue activity than requested.");
  }

  return result;
}
