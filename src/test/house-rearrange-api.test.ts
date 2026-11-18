import { describe, expect, it, vi } from "vitest";
import { createRearrangeHandler } from "@/lib/house-rearrange.server";
const player = "22222222-2222-4222-8222-222222222222";
const house = "33333333-3333-4333-8333-333333333333";
const item = "44444444-4444-4444-8444-444444444444";
const state = {
  house: { id: house, house_type_id: "single-room", house_type: { slots: [] } },
  placements: [
    {
      id: item,
      item_id: "bed",
      slot: "bed",
      x: 50,
      y: 50,
      floor: 0,
      rotation_deg: 0,
      art_key: "bed",
      category: "furniture",
      slot_type: "bed",
    },
  ],
};
describe("trusted rearrangement API", () => {
  it("requires authentication without reading or modifying furniture", async () => {
    const rpc = vi.fn();
    const response = await createRearrangeHandler({ authenticate: async () => null, rpc })(
      new Request("http://test"),
    );
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("ignores supplied player and furniture data and uses a server snapshot", async () => {
    const rpc = vi.fn().mockResolvedValueOnce(state).mockResolvedValueOnce({ ok: true, state });
    const response = await createRearrangeHandler({ authenticate: async () => player, rpc })(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ playerId: "attacker", moves: [] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc.mock.calls[1]![0]).toBe("house_rearrange_owned_items");
    expect(rpc.mock.calls[1]![1]).toMatchObject({
      p_player_id: player,
      p_house_id: house,
      p_expected: [{ id: item, x: 50, y: 50, slot: "bed" }],
    });
    expect(rpc.mock.calls[1]![1].p_moves).toHaveLength(1);
  });
  it("returns an actionable conflict on a concurrent layout change", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce(state)
      .mockRejectedValueOnce(new Error("LAYOUT_CHANGED"));
    const response = await createRearrangeHandler({ authenticate: async () => player, rpc })(
      new Request("http://test"),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "LAYOUT_CHANGED" } });
  });
});
