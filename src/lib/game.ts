// Client-side data access for OSOGBO LIFE.
// Reads go through RLS-protected tables (players only ever see their own rows).
// Every state change goes through server-validated database functions (RPCs);
// the browser has no write access to characters, wallets, missions, etc.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { normalizeCityLocation } from "@/lib/location-service";

export type Character = Database["public"]["Tables"]["characters"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type MapLocation = Pick<
  Location,
  | "id"
  | "name"
  | "slug"
  | "type"
  | "description"
  | "latitude"
  | "longitude"
  | "icon"
  | "image_url"
  | "is_active"
  | "level_required"
  | "metadata"
>;
export type GamePlace = Database["public"]["Tables"]["game_places"]["Row"];
export type GameBillboard = Database["public"]["Tables"]["game_billboards"]["Row"];
export type Advertisement = Database["public"]["Tables"]["advertisements"]["Row"];

export const XP_PER_LEVEL = 150;
export const ENERGY_REGEN_SECONDS = 120;

export function formatNaira(n: number | bigint | null | undefined) {
  return "₦" + Number(n ?? 0).toLocaleString("en-NG");
}

export function xpProgress(xp: number) {
  const into = xp % XP_PER_LEVEL;
  return { into, needed: XP_PER_LEVEL, pct: (into / XP_PER_LEVEL) * 100 };
}

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const q = {
  character: () =>
    queryOptions({
      queryKey: ["character"],
      retry: false,
      queryFn: async () => unwrap(await supabase.from("characters").select("*").maybeSingle()),
    }),
  profile: () =>
    queryOptions({
      queryKey: ["profile"],
      queryFn: async () => unwrap(await supabase.from("profiles").select("*").maybeSingle()),
    }),
  wallet: () =>
    queryOptions({
      queryKey: ["wallet"],
      queryFn: async () => unwrap(await supabase.from("wallets").select("*").maybeSingle()),
    }),
  transactions: () =>
    queryOptions({
      queryKey: ["transactions"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30),
        ),
    }),
  jobs: () =>
    queryOptions({
      queryKey: ["jobs"],
      staleTime: 5 * 60_000,
      retry: false,
      queryFn: async () => unwrap(await supabase.from("jobs").select("*").order("sort_order")),
    }),
  places: () =>
    queryOptions({
      queryKey: ["places"],
      staleTime: 5 * 60_000,
      queryFn: async () =>
        unwrap(await supabase.from("game_places").select("*").order("sort_order")),
    }),
  billboards: () =>
    queryOptions({
      queryKey: ["billboards"],
      staleTime: 60_000,
      queryFn: async () =>
        unwrap(
          await supabase.from("game_billboards").select("*").eq("status", "active").order("name"),
        ),
    }),
  advertisements: () =>
    queryOptions({
      queryKey: ["advertisements"],
      staleTime: 60_000,
      queryFn: async () =>
        unwrap(
          await supabase
            .from("advertisements")
            .select("*")
            .eq("status", "active")
            .order("starts_at", { ascending: false }),
        ),
    }),
  educationCourses: () =>
    queryOptions({
      queryKey: ["educationCourses"],
      staleTime: 5 * 60_000,
      queryFn: async () =>
        unwrap(await supabase.from("education_courses").select("*").order("sort_order")),
    }),
  myCourses: () =>
    queryOptions({
      queryKey: ["myCourses"],
      queryFn: async () => unwrap(await supabase.from("player_courses").select("*")),
    }),
  myJobs: () =>
    queryOptions({
      queryKey: ["myJobs"],
      queryFn: async () => unwrap(await supabase.from("character_jobs").select("*")),
    }),
  locations: () =>
    queryOptions({
      queryKey: ["locations"],
      staleTime: 5 * 60_000,
      queryFn: async () => unwrap(await supabase.from("locations").select("*").order("sort_order")),
    }),
  mapLocations: () =>
    queryOptions({
      queryKey: ["mapLocations"],
      staleTime: 60_000,
      queryFn: async () => {
        const locations = unwrap(
          await supabase
            .from("locations")
            .select(
              "id,name,slug,type,description,latitude,longitude,icon,image_url,is_active,level_required,metadata",
            )
            .eq("is_active", true)
            .order("name"),
        );
        return (locations ?? []).map(normalizeCityLocation);
      },
    }),
  visits: () =>
    queryOptions({
      queryKey: ["visits"],
      queryFn: async () => unwrap(await supabase.from("location_visits").select("*")),
    }),
  inventory: () =>
    queryOptions({
      queryKey: ["inventory"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("player_inventory")
            .select("*, item:inventory_items(*)")
            .order("acquired_at"),
        ),
    }),
  missions: () =>
    queryOptions({
      queryKey: ["missions"],
      queryFn: async () =>
        unwrap(await supabase.from("player_missions").select("*, mission:missions(*)")),
    }),
  notifications: () =>
    queryOptions({
      queryKey: ["notifications"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
        ),
    }),
};

/** Wraps a server-validated game action; refreshes all player data after it runs. */
export function useGameAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts?: { onSuccess?: (r: TResult) => void; onError?: (error: Error) => void },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => opts?.onSuccess?.(r),
    onError: (e: Error) => {
      opts?.onError?.(e);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries(),
  });
}

export const rpc = {
  refreshEnergy: async () => unwrap(await supabase.rpc("refresh_my_energy")),
  selectJob: async (jobId: string) => unwrap(await supabase.rpc("select_job", { p_job_id: jobId })),
  completeEducationCourse: async (courseSlug: string) =>
    unwrap(
      await supabase.rpc("complete_education_course", { p_course_slug: courseSlug }),
    ) as unknown as {
      course: string;
      tuition: number;
      energy_spent: number;
      intelligence_gain: number;
      career_gain: number;
    },
  performJob: async () =>
    unwrap(await supabase.rpc("perform_job")) as unknown as {
      earned: number;
      xp: number;
      energy_spent: number;
      hunger_gained: number;
      stress_gained: number;
      level: number;
    },
  travelToLocation: async (locationId: string) =>
    unwrap(await supabase.rpc("travel_to_location", { p_location_id: locationId })) as unknown as {
      location: string;
      fare: number;
      travel_minutes: number;
      first_visit: boolean;
      game_time?: { minute: number; hour: number; day: number; weekday: number };
    },
  eatAtPlace: async (placeId: string) =>
    unwrap(await supabase.rpc("eat_at_place", { p_place_id: placeId })) as unknown as {
      venue: string;
      cost: number;
      hunger_restored: number;
      happiness_gained: number;
    },
  visitLocation: async (id: string) =>
    unwrap(await supabase.rpc("visit_location", { p_location_id: id })) as unknown as {
      first_visit: boolean;
    },
  claimMission: async (id: string) =>
    unwrap(await supabase.rpc("claim_mission", { p_player_mission_id: id })) as unknown as {
      money: number;
      xp: number;
    },
  markRead: async (id?: string) =>
    unwrap(await supabase.rpc("mark_notifications_read", id ? { p_id: id } : {})),
};
