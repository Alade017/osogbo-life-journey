import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));

describe("payHomeRent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    getSession.mockReset();
  });

  it("sends the key and session token, and returns the server result", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, status: "current" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { payHomeRent } = await import("@/lib/home-rent-service");

    await expect(payHomeRent("key-1")).resolves.toEqual({ ok: true, status: "current" });
    expect(fetchMock).toHaveBeenCalledWith("/api/housing/pay-rent", {
      method: "POST",
      headers: { "Idempotency-Key": "key-1", Authorization: "Bearer token-1" },
    });
  });

  it("surfaces the server's reason when the payment is refused", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { reason: "INSUFFICIENT_FUNDS" } }), {
          status: 402,
        }),
      ),
    );
    const { payHomeRent } = await import("@/lib/home-rent-service");

    await expect(payHomeRent("key-2")).rejects.toThrow("INSUFFICIENT_FUNDS");
  });

  it("falls back to a plain message when the failure has no readable reason", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    const { payHomeRent } = await import("@/lib/home-rent-service");

    await expect(payHomeRent("key-3")).rejects.toThrow("Rent could not be paid. Try again.");
  });
});
