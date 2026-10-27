import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const stamp = z.string().datetime({ offset: true });
const receipt = z
  .object({
    requestId: z.string().uuid(),
    amount: money.max(700),
    cash: money,
    transactionId: z.string().uuid().nullable(),
    claimedAt: stamp,
    policyVersion: z.literal(1),
  })
  .refine((r) => r.amount > 0 === (r.transactionId !== null));
const snapshot = z
  .object({
    serverTime: stamp,
    asOf: stamp,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ratePerHour: z.literal(10),
    dailyCap: z.literal(100),
    retainedDates: z.literal(7),
    policyVersion: z.literal(1),
    hasStall: z.boolean(),
    enrolled: z.boolean(),
    isOpen: z.boolean(),
    claimable: money.max(700),
    todayEarned: money.max(100),
    todayPaid: money.max(100),
    lastReceipt: receipt.nullable(),
  })
  .refine(
    (s) => s.todayPaid <= s.todayEarned && (!s.enrolled || s.hasStall) && (!s.isOpen || s.enrolled),
  );
export type StallIncomeSnapshot = z.infer<typeof snapshot>;
export type StallIncomeReceipt = z.infer<typeof receipt>;
export const stallIncomeKey = (userId: string) => ["stallIncome", userId] as const;
const errorMessage = (error: { message: string; code?: string }) =>
  error.code === "PGRST202"
    ? "Stall income is not available yet. Your saved stall is still usable."
    : "Stall income could not be confirmed. Refresh or retry.";
export async function readStallIncome(): Promise<StallIncomeSnapshot> {
  const { data, error } = await supabase.rpc("get_stall_income");
  if (error) throw new Error(errorMessage(error));
  const parsed = snapshot.safeParse(data);
  if (!parsed.success) throw new Error("Stall income data is unavailable. Refresh and try again.");
  return parsed.data;
}
export async function claimStallIncome(requestId: string) {
  const { data, error } = await supabase.rpc("claim_stall_income", { p_request_id: requestId });
  if (error) throw new Error(errorMessage(error));
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data["duplicate"] !== "boolean"
  )
    throw new Error("The stall payout was not confirmed. Retry the same claim.");
  const parsed = receipt.safeParse(data);
  if (!parsed.success || parsed.data.requestId !== requestId)
    throw new Error("The stall payout was not confirmed. Retry the same claim.");
  return { ...parsed.data, duplicate: data["duplicate"] };
}
