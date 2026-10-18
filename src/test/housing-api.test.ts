// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHousingApiHandlers } from "@/lib/housing-api.server";

function setup() {
  const calls = {
    properties: vi.fn(async () => []),
    rentProperty: vi.fn(async () => ({ status: "current" })),
    payRent: vi.fn(async () => ({ status: "current" })),
    resolveOverdue: vi.fn(async () => ({ option: "loan" })),
  };
  return {
    calls,
    handlers: createHousingApiHandlers({
      authenticate: async () => "player-1",
      properties: calls.properties,
      eligible: async () => ({}),
      choose: async () => ({}),
      rent: async () => ({}),
      rentProperty: calls.rentProperty,
      payRent: calls.payRent,
      resolveOverdue: calls.resolveOverdue,
      defer: async () => ({}),
      home: async () => ({}),
      mutateItem: async () => ({}),
    }),
  };
}

const requestId = "1f10c784-9835-4b03-aee2-d631ce868007";
const propertyId = "31111111-1111-4111-8111-111111111111";

describe("unified housing API handlers", () => {
  it("lists properties for the authenticated player", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.getProperties(
      new Request("https://game.test/api/housing/properties"),
    );
    expect(response.status).toBe(200);
    expect(calls.properties).toHaveBeenCalledWith("player-1");
  });

  it("requires a UUID request receipt when renting a unified property", async () => {
    const { handlers, calls } = setup();
    const response = await handlers.postRent(
      new Request("https://game.test/api/housing/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
        body: JSON.stringify({ property_id: propertyId }),
      }),
    );
    expect(response.status).toBe(200);
    expect(calls.rentProperty).toHaveBeenCalledWith("player-1", propertyId, requestId);
  });

  it("delegates rent payment and overdue resolution only after validating receipts", async () => {
    const { handlers, calls } = setup();
    const pay = await handlers.postPayRent(
      new Request("https://game.test/api/housing/pay-rent", {
        method: "POST",
        headers: { "Idempotency-Key": requestId },
      }),
    );
    const resolve = await handlers.postResolveOverdue(
      new Request("https://game.test/api/housing/resolve-overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
        body: JSON.stringify({ option: "loan" }),
      }),
    );
    expect(pay.status).toBe(200);
    expect(resolve.status).toBe(200);
    expect(calls.payRent).toHaveBeenCalledWith("player-1", requestId);
    expect(calls.resolveOverdue).toHaveBeenCalledWith("player-1", "loan", requestId);
  });
});
