import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CareerRank } from "@/lib/career-rules";

const db = supabase as unknown as SupabaseClient;
const pathSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  mood_reward: z.number(),
});
const rankSchema = z.object({
  path_slug: z.string(),
  level: z.number().int().min(1).max(3),
  title: z.string(),
  salary: z.number().int().positive(),
  required_shifts: z.number().int().nonnegative(),
  required_skill_level: z.number().int().nonnegative(),
  steps: z.tuple([z.string(), z.string(), z.string()]),
});
const shiftSchema = z.object({
  id: z.string().uuid(),
  character_job_id: z.string().uuid(),
  location_id: z.string().uuid(),
  path_slug: z.string(),
  rank_level: z.number().int().min(1).max(3),
  step_count: z.number().int().min(0).max(3),
  status: z.enum(["active", "completed", "cancelled"]),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  paid_amount: z.number().int().nonnegative(),
  next_step_at: z.string(),
});
const actionSchema = z.object({
  id: z.string().uuid(),
  step_count: z.number().int().min(0).max(3),
  status: z.string(),
});
const claimSchema = z.object({
  id: z.string().uuid(),
  earned: z.number().int().positive(),
  status: z.literal("completed"),
  duplicate: z.boolean(),
});

export type CareerPath = z.infer<typeof pathSchema>;
export type CareerShift = z.infer<typeof shiftSchema>;

function result<T>(
  response: { data: unknown; error: { message: string } | null },
  schema: z.ZodType<T>,
): T {
  if (response.error) throw new Error(response.error.message);
  return schema.parse(response.data);
}

export async function loadCareerCatalog(): Promise<{ paths: CareerPath[]; ranks: CareerRank[] }> {
  const [paths, ranks] = await Promise.all([
    db.from("career_paths").select("*").order("name"),
    db.from("career_ranks").select("*").order("path_slug").order("level"),
  ]);
  return { paths: result(paths, pathSchema.array()), ranks: result(ranks, rankSchema.array()) };
}

export async function loadCareerShifts(): Promise<CareerShift[]> {
  return result(
    await db.from("career_shifts").select("*").order("started_at", { ascending: false }).limit(30),
    shiftSchema.array(),
  );
}

export async function startCareerShift() {
  return result(await db.rpc("start_career_shift"), actionSchema);
}

export async function completeCareerStep(args: { shiftId: string; step: number }) {
  return result(
    await db.rpc("complete_career_step", { p_shift_id: args.shiftId, p_step: args.step }),
    actionSchema,
  );
}

export async function claimCareerShift(shiftId: string) {
  return result(await db.rpc("claim_career_shift", { p_shift_id: shiftId }), claimSchema);
}

export async function cancelCareerShift(shiftId: string) {
  return result(
    await db.rpc("cancel_career_shift", { p_shift_id: shiftId }),
    z.object({ id: z.string().uuid(), status: z.literal("cancelled") }),
  );
}

export async function promoteCareer() {
  return result(
    await db.rpc("promote_career"),
    z.object({ career_level: z.number().int(), title: z.string(), salary: z.number().int() }),
  );
}

export async function leaveCareer() {
  return result(
    await db.rpc("leave_career"),
    z.object({ left: z.literal(true), employment_id: z.string().uuid() }),
  );
}
