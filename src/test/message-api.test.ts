import { describe, expect, it, vi } from "vitest";
import { createMessageSendHandler, MESSAGE_PAYLOAD_BYTE_LIMIT } from "@/lib/message-api.server";

const validId = "1c3d38fc-c980-4ad0-bf6f-fcb7bcbd41ca";
const request = (body: unknown) =>
  new Request("https://game.test/api/messages/send", {
    method: "POST",
    headers: { "Idempotency-Key": validId },
    body: JSON.stringify(body),
  });

describe("message send API", () => {
  it("rejects unauthenticated requests without reading the body", async () => {
    const send = vi.fn();
    const handler = createMessageSendHandler({ authenticate: async () => null, send });
    expect((await handler(request({}))).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])("bounds streamed bytes with Content-Length %s", async (length) => {
    const send = vi.fn();
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"body":"'));
        controller.enqueue(new TextEncoder().encode("a".repeat(MESSAGE_PAYLOAD_BYTE_LIMIT)));
      },
      cancel,
    });
    const incoming = new Request("https://game.test/api/messages/send", {
      method: "POST",
      body: stream,
      headers: length ? { "Content-Length": length } : {},
      duplex: "half",
    } as RequestInit);
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send });
    const result = await handler(incoming);
    expect(result.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts exactly the payload byte cap and rejects one more byte", async () => {
    const send = vi.fn().mockResolvedValue({ id: "message" });
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send });
    const raw = JSON.stringify({ channel: "private", body: "Hi", conversationId: validId });
    for (const extra of [0, 1]) {
      const incoming = new Request("https://game.test/api/messages/send", {
        method: "POST",
        headers: { "Idempotency-Key": validId },
        body: raw.padEnd(MESSAGE_PAYLOAD_BYTE_LIMIT + extra, " "),
      });
      expect((await handler(incoming)).status).toBe(extra ? 413 : 200);
    }
    expect(send).toHaveBeenCalledOnce();
  });

  it("counts UTF-8 bytes, including ignored fields", async () => {
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send: vi.fn() });
    expect(
      (
        await handler(
          request({
            channel: "private",
            body: "Hi",
            conversationId: validId,
            extra: "🌍".repeat(5000),
          }),
        )
      ).status,
    ).toBe(413);
  });

  it.each([
    [],
    null,
    { channel: "private", body: "Hi", conversationId: "invalid" },
    { channel: "area", body: "Hi", locationId: "invalid" },
  ])("rejects malformed input %j", async (value) => {
    const send = vi.fn();
    const handler = createMessageSendHandler({ authenticate: async () => "user-1", send });
    expect((await handler(request(value))).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("maps database rate rejection to 429", async () => {
    const handler = createMessageSendHandler({
      authenticate: async () => "user-1",
      send: async () => {
        throw new Error("MESSAGE_RATE_LIMIT");
      },
    });
    expect(
      (await handler(request({ channel: "private", body: "Hi", conversationId: validId }))).status,
    ).toBe(429);
  });
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
