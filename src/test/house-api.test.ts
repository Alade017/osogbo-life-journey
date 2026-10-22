// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHouseApiHandlers } from "@/lib/house-api.server";

function setup(
  authenticate: (request: Request) => Promise<string | null> = async () => "player-1",
) {
  const calls = {
    place: vi.fn(async (_playerId: string, _itemId: string, _slot: string): Promise<unknown> => ({
      ok: true,
    })),
    buy: vi.fn(async (_playerId: string, _itemId: string, _key: string): Promise<unknown> => ({
      ok: true,
    })),
  };
  const handlers = createHouseApiHandlers({
    authenticate,
    state: async () => ({ house: null, placements: [], outfit: {}, inventory: [] }),
    place: calls.place,
    move: async () => ({ ok: true }),
    remove: async () => ({ ok: true }),
    equip: async () => ({ ok: true }),
    unequip: async () => ({ ok: true }),
    buy: calls.buy,
  });
  return { handlers, calls };
}

describe("house API handlers", () => {
  it("rejects calls without a signed-in session", async () => {
    const { handlers, calls } = setup(async () => null);
    const response = await handlers.postPlace(
      new Request("https://game.test/api/house/place", {
        method: "POST",
        body: JSON.stringify({ itemId: "chair", slot: "seat" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(calls.place).not.toHaveBeenCalled();
  });

  it("passes the authenticated player and idempotency key to shop buy", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postBuy(
      new Request("https://game.test/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "repeat-shop-key-0001" },
        body: JSON.stringify({ itemId: "chair" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls.buy).toHaveBeenCalledWith("player-1", "chair", "repeat-shop-key-0001");
  });

  it("maps server ownership failures to a forbidden response", async () => {
    const { handlers, calls } = setup();
    calls.place.mockResolvedValue({ ok: false, code: "NOT_OWNED" });
    const response = await handlers.postPlace(
      new Request("https://game.test/api/house/place", {
        method: "POST",
        body: JSON.stringify({ itemId: "chair", slot: "seat" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "NOT_OWNED" } });
  });

  it("reports a missing house migration without exposing the database message", async () => {
    const { handlers } = setup();
    const broken = createHouseApiHandlers({
      authenticate: async () => "player-1",
      state: async () => {
        throw new Error("Could not find the function public.get_house_state in the schema cache");
      },
      place: async () => ({}),
      move: async () => ({}),
      remove: async () => ({}),
      equip: async () => ({}),
      unequip: async () => ({}),
      buy: async () => ({}),
    });
    expect(handlers).toBeDefined();
    const response = await broken.getState(new Request("https://game.test/api/house/state"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "HOUSE_SETUP_REQUIRED" } });
  });
});
