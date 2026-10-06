// Client-side data access for OSOGBO LIFE.
// Reads go through RLS-protected tables (players only ever see their own rows).
// Every state change goes through server-validated database functions (RPCs);
// the browser has no write access to characters, wallets, missions, etc.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Character = Database["public"]["Tables"]["characters"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];

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
      queryFn: async () => unwrap(await supabase.from("jobs").select("*").order("sort_order")),
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
      queryFn: async () =>
        unwrap(await supabase.from("locations").select("*").order("sort_order")),
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
  opts?: { onSuccess?: (r: TResult) => void },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => opts?.onSuccess?.(r),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => qc.invalidateQueries(),
  });
}

export const rpc = {
  refreshEnergy: async () => unwrap(await supabase.rpc("refresh_my_energy")),
  selectJob: async (jobId: string) => unwrap(await supabase.rpc("select_job", { p_job_id: jobId })),
  performJob: async () =>
    unwrap(await supabase.rpc("perform_job")) as unknown as {
      earned: number;
      xp: number;
      energy_spent: number;
      level: number;
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
