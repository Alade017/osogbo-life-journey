import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const count = z.number().int().nonnegative();
const timestamp = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid server timestamp");
export const craftQuoteSchema = z.object({
  duration_seconds: count.positive(),
  output_item_id: z.string().uuid(),
  output_quantity: count.positive(),
  materials: z.array(z.object({ item_id: z.string().uuid(), quantity: count.positive() })).min(1),
});
export const craftStartSchema = z.object({
  recipeId: z.string().min(1),
  requestId: z.string().uuid(),
  quote: craftQuoteSchema,
});
export type CraftStart = z.infer<typeof craftStartSchema>;
const recipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  zone_id: z.string(),
  station_name: z.string(),
  duration_seconds: count.positive(),
  output_name: z.string(),
  output_quantity: count.positive(),
  quote: craftQuoteSchema,
  available: z.boolean(),
  materials: z.array(z.object({ name: z.string(), quantity: count.positive(), owned: count })),
});
const jobSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  name: z.string(),
  zone_id: z.string(),
  station_name: z.string(),
  ready_at: timestamp,
  claimed_at: timestamp.nullable(),
  output_name: z.string(),
  output_quantity: count.positive(),
  started_at: timestamp,
});
export const craftingStateSchema = z.object({
  server_now: timestamp,
  recipes: z.array(recipeSchema),
  jobs: z.array(jobSchema),
});
const db = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
async function call(name: string, args: Record<string, unknown>) {
  const { data, error } = await db(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function fetchCrafting(zoneId: string) {
  return craftingStateSchema.parse(await call("my_adire_crafting", { p_zone_id: zoneId }));
}
export async function startCrafting(intent: CraftStart) {
  return z.object({ ok: z.literal(true), job_id: z.string().uuid() }).parse(
    await call("start_adire_craft", {
      p_recipe_id: intent.recipeId,
      p_request_id: intent.requestId,
      p_quote: intent.quote,
    }),
  );
}
export async function collectCrafting(jobId: string, zoneId: string) {
  return z
    .object({ ok: z.literal(true), job_id: z.literal(jobId) })
    .parse(await call("collect_adire_craft", { p_job_id: jobId, p_zone_id: zoneId }));
}
const messages: Record<string, string> = {
  MISSING_MATERIALS: "You need more materials. Buy them from the materials counter.",
  RECIPE_CHANGED: "This recipe changed. Reload the recipes before starting again.",
  CRAFT_IN_PROGRESS: "Collect your current craft before starting another one.",
  OUTPUT_STACK_FULL: "Your finished-item stack is full. Sell some items, then collect again.",
  VISIT_CRAFT_STATION: "Return to the correct Adire station in City Centre, outside your home.",
  CRAFT_NOT_READY: "The server says this craft is not ready yet. Wait a little longer.",
  CRAFT_NOT_FOUND: "That crafting job is unavailable for your character.",
  RECIPE_UNAVAILABLE: "This recipe is unavailable.",
  NO_CHARACTER: "Your character could not be loaded.",
};
export function craftingError(error: unknown): string {
  return error instanceof Error && messages[error.message]
    ? messages[error.message]!
    : "The response could not be confirmed. Retry the same request; materials and rewards will not be duplicated.";
}
export function definiteCraftingRejection(error: unknown) {
  return error instanceof Error && Object.hasOwn(messages, error.message);
}
/** Only display an estimate. Collection is always validated against the server clock. */
export function craftSecondsLeft(readyAt: string, serverNow: string, elapsedMilliseconds: number) {
  return Math.max(
    0,
    Math.ceil(
      (Date.parse(readyAt) - Date.parse(serverNow) - Math.max(0, elapsedMilliseconds)) / 1000,
    ),
  );
}
