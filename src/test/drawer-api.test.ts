import { describe, expect, it, vi } from "vitest";
import { createDrawerApiHandlers } from "@/lib/drawer-api.server";

const PLAYER = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";

function deps(overrides: Partial<Parameters<typeof createDrawerApiHandlers>[0]> = {}) {
  return {
    authenticate: vi.fn(async () => PLAYER),
    state: vi.fn(async () => ({ capacity: 24, items: [] })),
    store: vi.fn(async () => ({ ok: true, state: {}, drawer: { capacity: 24, items: [] } })),
    retrieve: vi.fn(async () => ({ ok: true })),
    equip: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

function post(body: unknown) {
  return new Request("https://example.test/api/drawer/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("drawer API handlers", () => {
  it("rejects requests without a signed-in player", async () => {
    const handlers = createDrawerApiHandlers(deps({ authenticate: async () => null }));
    const response = await handlers.getState(new Request("https://example.test/api/drawer/state"));
    expect(response.status).toBe(401);
  });

  it("returns the drawer state for the signed-in player", async () => {
    const d = deps();
    const handlers = createDrawerApiHandlers(d);
    const response = await handlers.getState(new Request("https://example.test/api/drawer/state"));
    expect(response.status).toBe(200);
    expect(d.state).toHaveBeenCalledWith(PLAYER);
  });

  it("stores by inventory id and passes the player id", async () => {
    const d = deps();
    const handlers = createDrawerApiHandlers(d);
    const response = await handlers.postStore(post({ inventoryId: ITEM }));
    expect(response.status).toBe(200);
    expect(d.store).toHaveBeenCalledWith(PLAYER, ITEM);
  });

  it("rejects ids that are not uuids before reaching the database", async () => {
    const d = deps();
    const handlers = createDrawerApiHandlers(d);
    const response = await handlers.postRetrieve(post({ drawerId: "'; drop table" }));
    expect(response.status).toBe(400);
    expect(d.retrieve).not.toHaveBeenCalled();
  });

  it("turns a full-drawer result into a 409 with its code", async () => {
    const handlers = createDrawerApiHandlers(
      deps({ store: async () => ({ ok: false, code: "DRAWER_FULL" }) }),
    );
    const response = await handlers.postStore(post({ inventoryId: ITEM }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "DRAWER_FULL" } });
  });
});
