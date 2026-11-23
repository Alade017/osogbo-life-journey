import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_RPC_TIMEOUT_MS } from "@/lib/request-timeout";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("market stall RPC timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    rpc.mockReset();
  });

  it("fails a hung rent request instead of leaving it pending", async () => {
    vi.useFakeTimers();
    rpc.mockReturnValue(new Promise(() => {}));
    const { rentMarketStall } = await import("@/lib/market-stall-service");

    const outcome = rentMarketStall("11111111-1111-4111-8111-111111111111").then(
      () => "resolved",
      (error: Error) => error.message,
    );
    await vi.advanceTimersByTimeAsync(GAME_RPC_TIMEOUT_MS);

    await expect(outcome).resolves.toBe(
      "The market did not respond. Check your connection and try again.",
    );
  });

  it("passes a settled RPC result through unchanged", async () => {
    rpc.mockResolvedValue({
      data: {
        propertyId: "22222222-2222-4222-8222-222222222222",
        playerPropertyId: "33333333-3333-4333-8333-333333333333",
        weeklyRentMinor: 2000,
        dueAt: "2026-11-30T10:00:00.000Z",
        status: "current",
        cash: 5000,
        duplicate: false,
      },
      error: null,
    });
    const { rentMarketStall } = await import("@/lib/market-stall-service");

    const receipt = await rentMarketStall("44444444-4444-4444-8444-444444444444");
    expect(receipt.status).toBe("current");
    expect(receipt.weeklyRentMinor).toBe(2000);
  });
});
