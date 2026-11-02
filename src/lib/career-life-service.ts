import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
const summarySchema = z.object({
  earned: z.number().nonnegative(),
  shifts: z.number().int().nonnegative(),
  employments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      current: z.boolean(),
      level: z.number(),
      shifts: z.number(),
      hiredAt: z.string(),
      lastWorkedAt: z.string().nullable(),
      location: z.string().nullable(),
      requiredCourse: z.string().nullable(),
    }),
  ),
});
const historySchema = z.array(
  z.object({
    id: z.string(),
    at: z.string(),
    kind: z.enum(["joined", "left", "promoted", "payment"]),
    label: z.string(),
    amount: z.number().nullable(),
    level: z.number().nullable(),
  }),
);

export async function loadCareerLifeSummary() {
  const { data, error } = await db.rpc("get_career_life_summary");
  if (error) throw new Error(error.message);
  return summarySchema.parse(data);
}

export async function loadCareerLifeHistory(offset: number) {
  const { data, error } = await db.rpc("get_career_life_history", { p_offset: offset });
  if (error) throw new Error(error.message);
  const rows = historySchema.parse(data);
  return { rows: rows.slice(0, 20), hasMore: rows.length > 20 };
}

export async function loadSavedCourses(characterId: string) {
  const { data, error } = await db
    .from("player_course_plans")
    .select("course_id,planned_at")
    .eq("character_id", characterId)
    .order("planned_at", { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(z.object({ course_id: z.string(), planned_at: z.string() })).parse(data);
}

export async function setSavedCourse(args: { slug: string; saved: boolean }) {
  const { error } = await db.rpc("set_saved_course", {
    p_course_slug: args.slug,
    p_saved: args.saved,
  });
  if (error) throw new Error(error.message);
}
