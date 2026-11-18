import { beforeEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import {
  getMyStallStock,
  getPublicStallStock,
  manageMyStallStock,
} from "@/lib/market-stall-service";
const id = "11111111-1111-4111-8111-111111111111",
  itemId = "22222222-2222-4222-8222-222222222222",
  requestId = "33333333-3333-4333-8333-333333333333";
const row = {
  id,
  itemId,
  name: "Cotton",
  description: null,
  priceMinor: 100,
  quantity: 0,
  referenceBuyPrice: 100,
};
beforeEach(() => rpc.mockReset());
it("accepts sold-out owner stock but rejects zero quantities in public listings", async () => {
  rpc.mockResolvedValue({ data: [row], error: null });
  expect(await getMyStallStock()).toEqual([row]);
  const { referenceBuyPrice: _, ...publicRow } = row;
  rpc.mockResolvedValue({ data: [publicRow], error: null });
  await expect(getPublicStallStock(id)).rejects.toThrow();
});
it("always sends the saved stock nonce and explicit nullable arguments", async () => {
  rpc.mockResolvedValue({ data: { ok: true, action: "remove", id, quantity: 0 }, error: null });
  await manageMyStallStock({ action: "remove", itemId: id, requestId });
  expect(rpc).toHaveBeenCalledWith("manage_my_stall_stock", {
    p_action: "remove",
    p_item_id: id,
    p_request_id: requestId,
    p_quantity: null,
    p_price_minor: null,
  });
});
it("rejects fractional quantities before calling the database", async () => {
  await expect(
    manageMyStallStock({ action: "add", itemId, requestId, quantity: 1.5, priceMinor: 100 }),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
