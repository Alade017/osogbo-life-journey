import { supabase } from "@/integrations/supabase/client";

export type CareerTrack = {
  slug: string; name: string; venue_slug: string; description: string;
  mood_delta: number; is_active: boolean;
};
export type CareerRank = { track_slug: string; level: number; title: string; shift_pay: number; promotion_shifts: number };
export type CareerVenue = { track_slug: string; location_id: string; locations: { name: string; slug: string } | null };
export type CareerApplication = {
  id: string; track_slug: string; status: "active" | "completed" | "resigned";
  career_level: number; completed_shifts: number; performance_points: number; last_shift_completed_at: string | null;
};
export type CareerSession = {
  id: string; application_id: string; location_id: string; status: "in_progress" | "completed" | "abandoned";
  steps_required: number; steps_completed: number; reward: number;
};
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};
function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
export const newCareerRequestId = () => crypto.randomUUID();
export async function listCareerTracks(): Promise<CareerTrack[]> {
  return unwrap(await db.from("career_tracks").select("slug,name,venue_slug,description,mood_delta,is_active").eq("is_active", true).order("name"));
}
export async function listCareerRanks(): Promise<CareerRank[]> {
  return unwrap(await db.from("career_ranks").select("track_slug,level,title,shift_pay,promotion_shifts").order("level"));
}
export async function listCareerVenues(): Promise<CareerVenue[]> {
  return unwrap(await db.from("career_track_venues").select("track_slug,location_id,locations(name,slug)"));
}
export async function getMyCareer(): Promise<CareerApplication | null> {
  const rows = unwrap<CareerApplication[]>(await db.from("career_applications")
    .select("id,track_slug,status,career_level,completed_shifts,performance_points,last_shift_completed_at")
    .eq("status", "active").limit(1));
  return rows[0] ?? null;
}
export async function getMyCareerSession(): Promise<CareerSession | null> {
  const rows = unwrap<CareerSession[]>(await db.from("career_sessions")
    .select("id,application_id,location_id,status,steps_required,steps_completed,reward")
    .eq("status", "in_progress").limit(1));
  return rows[0] ?? null;
}
export const careerRpc = {
  apply: (trackSlug: string, requestId = newCareerRequestId()) =>
    unwrap(db.rpc("apply_for_career", { p_track_slug: trackSlug, p_request_id: requestId })),
  startShift: (requestId = newCareerRequestId()) =>
    unwrap(db.rpc("start_career_shift", { p_request_id: requestId })),
  completeStep: (sessionId: string, stepNumber: number, requestId = newCareerRequestId()) =>
    unwrap(db.rpc("complete_career_step", { p_session_id: sessionId, p_step_number: stepNumber, p_request_id: requestId })),
  promote: (requestId = newCareerRequestId()) =>
    unwrap(db.rpc("promote_career", { p_request_id: requestId })),
};
