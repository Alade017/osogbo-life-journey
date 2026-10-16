import { describe, expect, it, vi } from "vitest";
import { createMessageSendHandler } from "@/lib/message-api.server";

const validId = "1c3d38fc-c980-4ad0-bf6f-fcb7bcbd41ca";
const request = (body: unknown) =>
  new Request("https://game.test/api/messages/send", {
    method: "POST",
    headers: { "Idempotency-Key": validId },
    body: JSON.stringify(body),
  });

describe("message send API", () => {
  it("accepts exactly 1,000 characters and passes the authenticated user to the database", async () => {
    const send = vi.fn().mockResolvedValue({ id: "message-1" });
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send });
    const response = await handler(
      request({ channel: "area", body: "a".repeat(1_000), locationId: validId }),
    );
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      "user-1",
      { channel: "area", body: "a".repeat(1_000), locationId: validId },
      validId,
    );
  });

  it("rejects messages over the cap before the database call", async () => {
    const send = vi.fn();
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send });
    const response = await handler(
      request({ channel: "private", body: "a".repeat(1_001), conversationId: validId }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "MESSAGE_LENGTH_INVALID" } });
    expect(send).not.toHaveBeenCalled();
  });

  it("validates and forwards a quoted message id", async () => {
    const send = vi.fn().mockResolvedValue({ id: "message-2" });
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send });
    const response = await handler(
      request({
        channel: "private",
        body: "Replying to your voice note",
        conversationId: validId,
        replyToMessageId: validId,
      }),
    );
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      "user-1",
      {
        channel: "private",
        body: "Replying to your voice note",
        conversationId: validId,
        replyToMessageId: validId,
      },
      validId,
    );
  });
});
