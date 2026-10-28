import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, auth: { getSession } } }));
import { getPublicStalls } from "@/lib/public-stall-service";
const owner = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const row = { id, ownerName: "Bisi", name: "Bisi's beads", goods: "Handmade beads" };
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: { items: [row], nextCursor: null } });
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: owner } } } });
});
describe("public stall projection service", () => {
  it("sends only a bounded page cursor, never an owner identity", async () => {
    expect(await getPublicStalls(owner)).toEqual({ items: [row], nextCursor: null });
    expect(rpc).toHaveBeenCalledWith("get_public_player_stalls", {
      p_limit: 20,
    });
    rpc.mockResolvedValue({ data: { items: [], nextCursor: null } });
    await getPublicStalls(owner, id);
    expect(rpc).toHaveBeenLastCalledWith("get_public_player_stalls", { p_after: id, p_limit: 20 });
  });
  it("rejects malformed cursors before calling the RPC", async () => {
    await expect(getPublicStalls(owner, "invalid")).rejects.toThrow("Invalid stall page");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { items: [{ ...row, user_id: owner }], nextCursor: null },
    { items: [row, row], nextCursor: null },
    { items: [row], nextCursor: owner },
    { items: [{ ...row, name: "x".repeat(65) }], nextCursor: null },
  ])("rejects malformed, private, or inconsistent response %j", async (data) => {
    rpc.mockResolvedValue({ data });
    await expect(getPublicStalls(owner)).rejects.toThrow("data is unavailable");
  });
  it("rejects a repeated cursor page", async () => {
    await expect(getPublicStalls(owner, id)).rejects.toThrow("data is unavailable");
  });
  it("does not request data for a different or missing session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(getPublicStalls(owner)).rejects.toThrow("Sign in");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("discards responses after an account switch", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: { user: { id: owner } } } })
      .mockResolvedValueOnce({ data: { session: { user: { id } } } });
    await expect(getPublicStalls(owner)).rejects.toThrow("Sign in");
  });
  it("explains missing migration without blocking owner management", async () => {
    rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    await expect(getPublicStalls(owner)).rejects.toThrow(
      "Your own stall and city shops are still usable",
    );
  });
});
