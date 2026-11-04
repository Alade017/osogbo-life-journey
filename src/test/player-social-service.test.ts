import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, rpc } = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession },
    rpc,
  },
}));

import { getSocialMessages, sendSocialMessage } from "@/lib/player-social-service";

const locationId = "1c3d38fc-c980-4ad0-bf6f-fcb7bcbd41ca";

describe("sendSocialMessage", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    rpc.mockReset();
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

  it("uses the composite history cursor and requests ascending messages", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "message-b",
          sender_character_id: "character-1",
          sender_name: "Player",
          channel: "private",
          location_id: null,
          conversation_id: "thread-1",
          body: "Second",
          message_type: "text",
          voice_duration_ms: null,
          reply_to_message_id: null,
          created_at: "2026-10-18T10:00:00.000Z",
        },
        {
          id: "message-a",
          sender_character_id: "character-1",
          sender_name: "Player",
          channel: "private",
          location_id: null,
          conversation_id: "thread-1",
          body: "First",
          message_type: "text",
          voice_duration_ms: null,
          reply_to_message_id: null,
          created_at: "2026-10-18T10:00:00.000Z",
        },
      ],
      error: null,
    });

    const messages = await getSocialMessages({
      conversationId: "thread-1",
      before: "2026-10-18T10:00:00.000Z",
      beforeId: "message-cursor",
    });

    expect(rpc).toHaveBeenCalledWith("get_social_messages_with_media_v2", {
      p_conversation_id: "thread-1",
      p_before: "2026-10-18T10:00:00.000Z",
      p_before_id: "message-cursor",
      p_limit: 50,
    });
    expect(messages.map((message) => message.id)).toEqual(["message-a", "message-b"]);
  });

  it("falls back to the legacy history RPC while the cursor migration is rolling out", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Function not found", code: "PGRST202" },
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(getSocialMessages({ conversationId: "thread-1" })).resolves.toEqual([]);
    expect(rpc).toHaveBeenNthCalledWith(2, "get_social_messages_with_media", {
      p_conversation_id: "thread-1",
      p_limit: 50,
    });
  });
});
