import { describe, expect, it, vi } from "vitest";
import { createHouseLightHandlers } from "@/lib/house-light-api.server";
import { parseLightOn } from "@/lib/house-light";

const PLAYER = "11111111-1111-4111-8111-111111111111";

describe("house light", () => {
  it("reads missing or malformed values as lit", () => {
    expect(parseLightOn(null)).toBe(true);
    expect(parseLightOn({})).toBe(true);
    expect(parseLightOn({ light_on: "off" })).toBe(true);
    expect(parseLightOn({ light_on: false })).toBe(false);
  });

  it("requires a signed-in player", async () => {
    const handlers = createHouseLightHandlers({
      authenticate: async () => null,
      get: vi.fn(),
      set: vi.fn(),
    });
    const response = await handlers.getLight(new Request("https://example.test/api/house/light"));
    expect(response.status).toBe(401);
  });

  it("saves the switch for the signed-in player", async () => {
    const set = vi.fn(async () => ({ ok: true, light_on: false }));
    const handlers = createHouseLightHandlers({
      authenticate: async () => PLAYER,
      get: vi.fn(),
      set,
    });
    const response = await handlers.postLight(
      new Request("https://example.test/api/house/light", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: false }),
      }),
    );
    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith(PLAYER, false);
  });

  it("rejects a switch value that is not a boolean", async () => {
    const set = vi.fn();
    const handlers = createHouseLightHandlers({
      authenticate: async () => PLAYER,
      get: vi.fn(),
      set,
    });
    const response = await handlers.postLight(
      new Request("https://example.test/api/house/light", {
        method: "POST",
        body: JSON.stringify({ on: "yes" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });
});
