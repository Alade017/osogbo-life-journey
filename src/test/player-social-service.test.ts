import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession },
  },
}));

import { sendSocialMessage } from "@/lib/player-social-service";

const locationId = "1c3d38fc-c980-4ad0-bf6f-fcb7bcbd41ca";

describe("sendSocialMessage", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("retries a lost network response once with the same idempotency key", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed")).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "message-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      sendSocialMessage({
        channel: "area",
        body: "Hello from Osun Life",
        locationId,
        idempotencyKey: "6a97f25b-5b4a-4ce5-af54-fbaae702fd31",
      }),
    ).resolves.toEqual({ id: "message-1" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(firstRequest.headers).toMatchObject({
      "Idempotency-Key": "6a97f25b-5b4a-4ce5-af54-fbaae702fd31",
    });
    expect(secondRequest.headers).toMatchObject({
      "Idempotency-Key": "6a97f25b-5b4a-4ce5-af54-fbaae702fd31",
    });
    expect(JSON.parse(String(firstRequest.body))).not.toHaveProperty("idempotencyKey");
  });
});
