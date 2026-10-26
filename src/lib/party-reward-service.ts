import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const stamp = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const receiptSchema = z.object({
  eventId: z.string().uuid(),
  date,
  awardedAt: stamp,
  reputationDelta: z.number().int().min(0).max(1),
  reputationAfter: z.number().int().min(0).max(100),
  reward: z.literal(1),
});
const eventSchema = z
  .object({
    eventId: z.string().uuid(),
    title: z.string(),
    endsAt: stamp,
    claimUntil: stamp,
    requirements: count,
    completed: count,
    guests: count,
    reason: z.enum([
      "claimed",
      "legacy",
      "cancelled",
      "not_ended",
      "expired",
      "requirements",
      "guests",
      "daily_cap",
      "eligible",
    ]),
    receipt: receiptSchema.nullable(),
  })
  .refine(
    (e) =>
      e.completed <= e.requirements &&
      Date.parse(e.claimUntil) >= Date.parse(e.endsAt) &&
      (e.reason !== "eligible" ||
        (e.requirements > 0 && e.completed === e.requirements && e.guests >= 2)) &&
      (e.reason === "claimed") === (e.receipt !== null) &&
      (!e.receipt || e.receipt.eventId === e.eventId),
  );
const snapshotSchema = z.object({
  serverTime: stamp,
  date,
  reward: z.literal(1),
  events: z.array(eventSchema),
});
export type PartyHostSnapshot = z.infer<typeof snapshotSchema>;
export type PartyHostEvent = z.infer<typeof eventSchema>;
export const partyHostKey = (userId: string) => ["partyHostResults", userId] as const;
const errorMessage = (error: { message: string; code?: string }) => {
  if (error.code === "PGRST202") return "Party rewards are not available yet. Try again later.";
  if (error.message.includes("STALE_DATE"))
    return "The Lagos day changed. Refresh the results before claiming.";
  if (error.message.includes("daily_cap"))
    return "Your party reward for today has already been used.";
  return "This party reward could not be confirmed. Refresh or retry.";
};
export async function readPartyHostResults(): Promise<PartyHostSnapshot> {
  const { data, error } = await supabase.rpc("get_party_host_results");
  if (error) throw new Error(errorMessage(error));
  const parsed = snapshotSchema.safeParse(data);
  if (!parsed.success) throw new Error("Party results are unavailable. Refresh and try again.");
  return parsed.data;
}
export async function claimPartyHostReward(input: { eventId: string; date: string }) {
  const { data, error } = await supabase.rpc("claim_party_host_reward", {
    p_event_id: input.eventId,
    p_date: input.date,
  });
  if (error) throw new Error(errorMessage(error));
  const parsed = receiptSchema.extend({ newlyAwarded: z.boolean() }).safeParse(data);
  if (
    !parsed.success ||
    parsed.data.eventId !== input.eventId ||
    (parsed.data.newlyAwarded && parsed.data.date !== input.date)
  )
    throw new Error("The party reward was not confirmed. Refresh before retrying.");
  return parsed.data;
}
