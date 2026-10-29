import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlayerMission = Database["public"]["Tables"]["player_missions"]["Row"] & {
  mission: Database["public"]["Tables"]["missions"]["Row"] | null;
};
export async function missionSession(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !userId || data.session?.user.id !== userId)
    throw new Error("Your account changed. Reopen Missions.");
}
export async function getMissions(userId: string, characterId: string): Promise<PlayerMission[]> {
  await missionSession(userId);
  const { data, error } = await supabase.from("player_missions").select("*, mission:missions(*)")
    .eq("user_id", userId).eq("character_id", characterId);
  await missionSession(userId);
  if (error) throw new Error("Missions could not be loaded. Try again.");
  return data ?? [];
}
export function orderedMissions(missions: readonly PlayerMission[]) {
  return missions.filter((m) => m.mission).slice().sort((a,b) =>
    (a.mission!.sort_order - b.mission!.sort_order) || a.id.localeCompare(b.id));
}
export function activeGoal(missions: readonly PlayerMission[]) {
  const ordered = orderedMissions(missions);
  return ordered.find((m)=>m.status === "completed") ?? ordered.find((m)=>m.status === "in_progress");
}
