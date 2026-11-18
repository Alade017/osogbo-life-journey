import { z } from "zod";
import { planHouseArrangement } from "@/game/house-arrangement";
import { json, safeServerErrorCode, statusByCode } from "./house-api.server";
const placementSchema = z.object({
  id: z.string().uuid(),
  item_id: z.string(),
  slot: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  floor: z.number().int().min(0).max(1).default(0),
  rotation_deg: z.number().default(0),
  art_key: z.string(),
  category: z.string(),
  slot_type: z.string(),
});
const stateSchema = z.object({
  house: z.object({
    id: z.string().uuid(),
    house_type_id: z.string(),
    house_type: z.object({
      slots: z.array(
        z.object({ id: z.string(), slot_type: z.string(), x: z.number(), y: z.number() }),
      ),
    }),
  }),
  placements: z.array(placementSchema).max(128),
});
type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};
export function createRearrangeHandler(deps: Dependencies) {
  return async (request: Request) => {
    const playerId = await deps.authenticate(request);
    if (!playerId) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    try {
      // Never trust client furniture, player ids, positions or room dimensions.
      const parsed = stateSchema.safeParse(
        await deps.rpc("get_house_state", { p_player_id: playerId }),
      );
      if (!parsed.success) return json({ error: { code: "NO_ACTIVE_HOUSE" } }, 409);
      const { house, placements } = parsed.data;
      const moves = planHouseArrangement(
        house.house_type_id,
        placements.map(({ x, y, ...p }) => ({
          ...p,
          ...(x === undefined ? {} : { x }),
          ...(y === undefined ? {} : { y }),
        })),
        house.house_type.slots,
      );
      if (!moves) return json({ error: { code: "NO_CLEAR_LAYOUT" } }, 409);
      const expected = [...placements]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => ({
          id: p.id,
          slot: p.slot,
          x: p.x ?? null,
          y: p.y ?? null,
          floor: p.floor,
          rotation_deg: p.rotation_deg,
        }));
      return json(
        await deps.rpc("house_rearrange_owned_items", {
          p_player_id: playerId,
          p_house_id: house.id,
          p_expected: expected,
          p_moves: moves,
        }),
      );
    } catch (error) {
      const code = safeServerErrorCode(error instanceof Error ? error.message : String(error));
      return json({ error: { code } }, statusByCode[code] ?? 500);
    }
  };
}
export async function handleHouseRearrange(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createRearrangeHandler({
    authenticate: async (req) => {
      const token = req.headers.get("authorization");
      if (!token?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(token.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    rpc: async (name, args) => {
      const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
      if (error) throw new Error(error.message);
      return data;
    },
  })(request);
}
