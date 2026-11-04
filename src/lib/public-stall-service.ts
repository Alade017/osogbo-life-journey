import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { publicStallCategorySchema, type PublicStallCategory } from "@/lib/market-stall-service";
const stall = z
  .object({
    id: z.string().uuid(),
    ownerName: z.string().min(1),
    name: z.string().min(2).max(64),
    goods: z.string().min(2).max(200),
    category: publicStallCategorySchema,
  })
  .strict();
const page = z
  .object({ items: z.array(stall).max(20), nextCursor: z.string().uuid().nullable() })
  .strict();
export type PublicStall = z.infer<typeof stall>;
export const publicStallKey = (accountId: string, category: PublicStallCategory | null = null) =>
  ["publicPlayerStalls", accountId, category] as const;
export async function getPublicStalls(
  accountId: string,
  after: string | null = null,
  category: PublicStallCategory | null = null,
) {
  if (after !== null && !z.string().uuid().safeParse(after).success)
    throw new Error("Invalid stall page.");
  if (category !== null) publicStallCategorySchema.parse(category);
  const { data: auth } = await supabase.auth.getSession();
  if (!accountId || auth.session?.user.id !== accountId)
    throw new Error("Sign in to browse player stalls.");
  const { data, error } = await supabase.rpc("get_public_player_stalls", {
    ...(after !== null ? { p_after: after } : {}),
    p_limit: 20,
    ...(category !== null ? { p_category: category } : {}),
  });
  const { data: currentAuth } = await supabase.auth.getSession();
  if (currentAuth.session?.user.id !== accountId)
    throw new Error("Sign in to browse player stalls.");
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Player stalls are not available yet. Your own stall and city shops are still usable."
        : "Player stalls could not be loaded. Try again.",
    );
  const parsed = page.safeParse(data);
  if (
    !parsed.success ||
    new Set(parsed.data.items.map((row) => row.id)).size !== parsed.data.items.length ||
    (after !== null && parsed.data.items.some((row) => row.id <= after)) ||
    (parsed.data.nextCursor !== null && parsed.data.nextCursor !== parsed.data.items.at(-1)?.id)
  )
    throw new Error("Player stall data is unavailable. Refresh and try again.");
  return parsed.data;
}
