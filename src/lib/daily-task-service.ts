import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DailyTask = {
  key: string;
  title: string;
  action: "eat" | "study" | "socialize";
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
};
export type DailyTaskSnapshot = {
  date: string;
  serverTime: string;
  resetsAt: string;
  tasks: DailyTask[];
};
export type DailyTaskClaim = {
  key: string;
  date: string;
  rewardXp: number;
  claimed: true;
  claimedAt: string;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const reward = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 5;
const invalid = () => new Error("The server returned invalid daily tasks. Refresh and try again.");
const rpcError = (error: { message: string; code?: string }) =>
  new Error(
    error.code === "PGRST202"
      ? "Daily tasks are not available yet. Try again later."
      : error.message,
  );

export function parseDailyTasks(value: unknown): DailyTaskSnapshot {
  if (
    !object(value) ||
    !date(value["date"]) ||
    !timestamp(value["serverTime"]) ||
    !timestamp(value["resetsAt"]) ||
    Date.parse(value["resetsAt"]) <= Date.parse(value["serverTime"]) ||
    !Array.isArray(value["tasks"]) ||
    value["tasks"].length > 3
  )
    throw invalid();
  const keys = new Set<string>();
  for (const task of value["tasks"]) {
    if (
      !object(task) ||
      typeof task["key"] !== "string" ||
      !["meal", "study", "social"].includes(task["key"]) ||
      keys.has(task["key"]) ||
      typeof task["title"] !== "string" ||
      !task["title"].trim() ||
      !["eat", "study", "socialize"].includes(String(task["action"])) ||
      !reward(task["rewardXp"]) ||
      typeof task["completed"] !== "boolean" ||
      typeof task["claimed"] !== "boolean" ||
      (task["claimed"] && !task["completed"])
    )
      throw invalid();
    keys.add(task["key"]);
  }
  return value as unknown as DailyTaskSnapshot;
}

export async function getDailyTasks(): Promise<DailyTaskSnapshot> {
  const { data, error } = await supabase.rpc("get_daily_tasks");
  if (error) throw rpcError(error);
  return parseDailyTasks(data);
}

export async function claimDailyTask(input: {
  key: string;
  date: string;
}): Promise<DailyTaskClaim> {
  const { data, error } = await supabase.rpc("claim_daily_task", {
    p_task_key: input.key,
    p_date: input.date,
  });
  if (error) throw rpcError(error);
  if (
    !object(data) ||
    data["key"] !== input.key ||
    data["date"] !== input.date ||
    data["claimed"] !== true ||
    !reward(data["rewardXp"]) ||
    !timestamp(data["claimedAt"])
  )
    throw invalid();
  return data as unknown as DailyTaskClaim;
}

export const dailyTasksKey = (userId: string) => ["dailyTasks", userId] as const;
export const dailyTaskOptions = (userId: string) =>
  queryOptions({
    queryKey: dailyTasksKey(userId),
    queryFn: getDailyTasks,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    // Use server duration plus elapsed time since receipt, independent of local timezone/clock offset.
    refetchInterval: (query) => {
      const snapshot = query.state.data;
      if (!snapshot) return false;
      return Math.max(
        1000,
        Math.min(
          60_000,
          Date.parse(snapshot.resetsAt) -
            Date.parse(snapshot.serverTime) -
            (Date.now() - query.state.dataUpdatedAt),
        ),
      );
    },
  });
