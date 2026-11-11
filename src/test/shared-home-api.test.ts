import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
  },
}));

import { handleSharedHomeJoin, handleSharedHomeLeave } from "@/lib/shared-home-api.server";

const userId = "a1111111-1111-4111-8111-111111111111";
const unitId = "b2222222-2222-4222-8222-222222222222";
const key = "c3333333-3333-4333-8333-333333333333";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/housing/shared-join", {
    method: "POST",
    headers: {
      authorization: "Bearer token",
      "Idempotency-Key": key,
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("shared room join and leave routes", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  });

  it("rejects a call without a valid session", async () => {
    const response = await handleSharedHomeJoin(
      new Request("https://example.test", { method: "POST" }),
    );
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed idempotency key", async () => {
    const response = await handleSharedHomeJoin(
      request({ unitId }, { "Idempotency-Key": "not-a-uuid" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_IDEMPOTENCY_KEY");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a body without a unit id", async () => {
    const response = await handleSharedHomeJoin(request({ unitId: "nope" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the caller, unit and key to the join function and returns its result", async () => {
    rpc.mockResolvedValue({ data: { bedSlot: 1, weeklyRentMinor: 2000 }, error: null });
    const response = await handleSharedHomeJoin(request({ unitId }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("shared_home_join", {
      p_user_id: userId,
      p_unit_id: unitId,
      p_request_id: key,
    });
    expect(await response.json()).toEqual({ bedSlot: 1, weeklyRentMinor: 2000 });
  });

  it("maps a full room to a conflict", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "UNIT_FULL" } });
    const response = await handleSharedHomeJoin(request({ unitId }));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("UNIT_FULL");
  });

  it("maps an unknown database error to a server error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "something unexpected" } });
    const response = await handleSharedHomeJoin(request({ unitId }));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("leaves with the caller and key and returns the refund", async () => {
    rpc.mockResolvedValue({ data: { refundMinor: 4000, bedSlot: 1 }, error: null });
    const response = await handleSharedHomeLeave(
      new Request("https://example.test/api/housing/shared-leave", {
        method: "POST",
        headers: { authorization: "Bearer token", "Idempotency-Key": key },
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("shared_home_leave", { p_user_id: userId, p_request_id: key });
    expect(await response.json()).toEqual({ refundMinor: 4000, bedSlot: 1 });
  });

  it("reports leaving when not in a shared room as not found", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "NOT_IN_SHARED_ROOM" } });
    const response = await handleSharedHomeLeave(
      new Request("https://example.test/api/housing/shared-leave", {
        method: "POST",
        headers: { authorization: "Bearer token", "Idempotency-Key": key },
      }),
    );
    expect(response.status).toBe(404);
  });
});
