import { describe, expect, it, vi } from "vitest";
import { createMapPlaceActionHandler, findMapPlaceAction } from "@/lib/map-place-action.server";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

describe("map place actions", () => {
  it("only passes a JSON-defined action to the authoritative callback", async () => {
    const perform = vi.fn(async (_userId, _placeId, _actionId, _requestId, action) => ({ action }));
    const handler = createMapPlaceActionHandler({
      authenticate: async () => "player-1",
      perform,
    });
    const response = await handler(
      new Request("http://local/api/map/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
        body: JSON.stringify({
          landmarkId: "oja-oba-market",
          actionId: "oja-oba-market-buy-food",
          money: 1,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(perform).toHaveBeenCalledWith(
      "player-1",
      "oja-oba-market",
      "oja-oba-market-buy-food",
      requestId,
      findMapPlaceAction("oja-oba-market", "oja-oba-market-buy-food")!.action,
    );
    expect(perform.mock.calls[0]![4].money_minor).toEqual({ min: 250, max: 450 });
  });

  it("rejects stale place action ids without invoking the RPC", async () => {
    const perform = vi.fn();
    const handler = createMapPlaceActionHandler({ authenticate: async () => "player-1", perform });
    const response = await handler(
      new Request("http://local/api/map/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
        body: JSON.stringify({ landmarkId: "old-landmark", actionId: "browse" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(perform).not.toHaveBeenCalled();
  });
});
