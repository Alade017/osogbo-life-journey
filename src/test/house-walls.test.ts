import { describe, expect, it, vi } from "vitest";
import { createHouseWallsHandlers } from "@/lib/house-walls-api.server";
import { parseWallsClosed } from "@/lib/house-walls";
import { houseWallSegments } from "@/components/game/housing/house-room-contract";

const PLAYER = "11111111-1111-4111-8111-111111111111";
const WALL_HEIGHT = 3;

describe("house walls", () => {
  it("reads a missing setting as the home default", () => {
    expect(parseWallsClosed(null)).toBeNull();
    expect(parseWallsClosed({})).toBeNull();
    expect(parseWallsClosed({ walls_closed: "yes" })).toBeNull();
    expect(parseWallsClosed({ walls_closed: true })).toBe(true);
    expect(parseWallsClosed({ walls_closed: false })).toBe(false);
  });

  it("closing the walls makes every wall full height except the doorway lintel", () => {
    const segments = houseWallSegments(10, 8, WALL_HEIGHT, 1.5, 0, true);
    for (const segment of segments) {
      if (segment.id === "rear-door-lintel") continue;
      expect(segment.size[1], segment.id).toBe(WALL_HEIGHT);
    }
  });

  it("opening the walls cuts the front and sides away", () => {
    const segments = houseWallSegments(10, 8, WALL_HEIGHT, 1.5, 0, false);
    const cut = segments.filter((segment) => segment.id.includes("cutaway"));
    expect(cut.length).toBeGreaterThan(0);
    for (const segment of cut) expect(segment.size[1], segment.id).toBeLessThan(WALL_HEIGHT);
  });

  it("requires a signed-in player", async () => {
    const handlers = createHouseWallsHandlers({
      authenticate: async () => null,
      get: vi.fn(),
      set: vi.fn(),
    });
    const response = await handlers.getWalls(new Request("https://example.test/api/house/walls"));
    expect(response.status).toBe(401);
  });

  it("saves the setting for the signed-in player and rejects non-boolean values", async () => {
    const set = vi.fn(async () => ({ ok: true, walls_closed: true }));
    const handlers = createHouseWallsHandlers({
      authenticate: async () => PLAYER,
      get: vi.fn(),
      set,
    });
    const ok = await handlers.postWalls(
      new Request("https://example.test/api/house/walls", {
        method: "POST",
        body: JSON.stringify({ closed: true }),
      }),
    );
    expect(ok.status).toBe(200);
    expect(set).toHaveBeenCalledWith(PLAYER, true);

    const bad = await handlers.postWalls(
      new Request("https://example.test/api/house/walls", {
        method: "POST",
        body: JSON.stringify({ closed: "yes" }),
      }),
    );
    expect(bad.status).toBe(400);
  });
});
