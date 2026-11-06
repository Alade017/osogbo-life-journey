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
    placeAt: vi.fn(
      async (_playerId: string, _itemId: string, _x: number, _y: number): Promise<unknown> => ({
        ok: true,
      }),
    ),
    move: vi.fn(
      async (_playerId: string, _fromSlot: string, _x: number, _y: number): Promise<unknown> => ({
        ok: true,
      }),
    ),
    rotate: vi.fn(
      async (_playerId: string, _fromSlot: string, _rotation: number): Promise<unknown> => ({
        ok: true,
      }),
    ),
    buy: vi.fn(async (_playerId: string, _itemId: string, _key: string): Promise<unknown> => ({
      ok: true,
    })),
  };
  const handlers = createHouseApiHandlers({
    authenticate,
    state: async () => ({ house: null, placements: [], outfit: {}, inventory: [] }),
    place: calls.place,
    placeAt: calls.placeAt,
    move: calls.move,
    rotate: calls.rotate,
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

  it("places furniture at a free grid position when coordinates are sent", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postPlace(
      new Request("https://game.test/api/house/place", {
        method: "POST",
        body: JSON.stringify({ itemId: "free-sofa", x: 38.5, y: 62 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls.placeAt).toHaveBeenCalledWith("player-1", "free-sofa", 38.5, 62);
    expect(calls.place).not.toHaveBeenCalled();
  });

  it("rejects free placements outside the room before reaching the database", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postPlace(
      new Request("https://game.test/api/house/place", {
        method: "POST",
        body: JSON.stringify({ itemId: "free-sofa", x: 1000, y: 50 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(calls.placeAt).not.toHaveBeenCalled();
  });

  it("persists a furniture drop at validated normalized room coordinates", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postMove(
      new Request("https://game.test/api/house/move", {
        method: "POST",
        body: JSON.stringify({ fromSlot: "bed", x: 38.5, y: 62 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls.move).toHaveBeenCalledWith("player-1", "bed", 38.5, 62);
  });

  it("rejects out-of-room furniture coordinates before reaching the database", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postMove(
      new Request("https://game.test/api/house/move", {
        method: "POST",
        body: JSON.stringify({ fromSlot: "bed", x: 1000, y: 50 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(calls.move).not.toHaveBeenCalled();
  });

  it("persists a validated accessory rotation", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postRotate(
      new Request("https://game.test/api/house/rotate", {
        method: "POST",
        body: JSON.stringify({ fromSlot: "bed", rotation: 135 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls.rotate).toHaveBeenCalledWith("player-1", "bed", 135);
  });

  it("rejects accessory rotations outside the supported range", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postRotate(
      new Request("https://game.test/api/house/rotate", {
        method: "POST",
        body: JSON.stringify({ fromSlot: "bed", rotation: 360 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(calls.rotate).not.toHaveBeenCalled();
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
      placeAt: async () => ({}),
      move: async () => ({}),
      rotate: async () => ({}),
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
