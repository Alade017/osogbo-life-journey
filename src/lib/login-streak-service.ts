import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export type LoginStreakSnapshot = {
  date: string;
  serverTime: string;
  resetsAt: string;
  streak: number;
  todayClaimed: boolean;
  rewardXp: number;
};
export type LoginStreakReceipt = {
  date: string;
  streak: number;
  rewardXp: number;
  claimedAt: string;
  newlyAwarded: boolean;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const day = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const stamp = (v: unknown): v is string =>
  typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const reward = (v: unknown): v is number => integer(v) && v <= 5;
const invalid = () =>
  new Error("The server returned an invalid daily check-in. Refresh and try again.");
const rpcError = (e: { message: string; code?: string }) =>
  new Error(
    e.code === "PGRST202" ? "Daily check-in is not available yet. Try again later." : e.message,
  );
export function parseLoginStreak(v: unknown): LoginStreakSnapshot {
  if (
    !object(v) ||
    !day(v["date"]) ||
    !stamp(v["serverTime"]) ||
    !stamp(v["resetsAt"]) ||
    Date.parse(v["resetsAt"]) <= Date.parse(v["serverTime"]) ||
    !integer(v["streak"]) ||
    !reward(v["rewardXp"]) ||
    typeof v["todayClaimed"] !== "boolean" ||
    (v["todayClaimed"] && v["streak"] === 0)
  )
    throw invalid();
  return v as unknown as LoginStreakSnapshot;
}
export async function getLoginStreak(): Promise<LoginStreakSnapshot> {
  const { data, error } = await supabase.rpc("get_login_streak");
  if (error) throw rpcError(error);
  return parseLoginStreak(data);
}
export async function checkInLogin(date: string): Promise<LoginStreakReceipt> {
  const { data: v, error } = await supabase.rpc("check_in_login", { p_date: date });
  if (error) throw rpcError(error);
  if (
    !object(v) ||
    v["date"] !== date ||
    !integer(v["streak"]) ||
    v["streak"] < 1 ||
    !reward(v["rewardXp"]) ||
    !stamp(v["claimedAt"]) ||
    typeof v["newlyAwarded"] !== "boolean"
  )
    throw invalid();
  return v as unknown as LoginStreakReceipt;
}
export const loginStreakKey = (userId: string) => ["loginStreak", userId] as const;
export const loginStreakOptions = (userId: string) =>
  queryOptions({
    queryKey: loginStreakKey(userId),
    queryFn: getLoginStreak,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return Math.max(
        1000,
        Math.min(
          60_000,
          Date.parse(data.resetsAt) -
            Date.parse(data.serverTime) -
            (Date.now() - query.state.dataUpdatedAt),
        ),
      );
    },
  });
