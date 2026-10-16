import { describe, expect, it } from "vitest";
import { createThreadHandler } from "@/lib/thread-api.server";

const threadId = "14e9343d-f925-44d3-8df5-6f57ec80aa02";
const request = (duration?: string) =>
  new Request(`https://game.test/api/threads/${threadId}`, {
    method: "POST",
    ...(duration ? { body: JSON.stringify({ duration }) } : {}),
  });

describe("thread preference API", () => {
  it("allows exactly one of two concurrent pin requests for the last slot", async () => {
    let pinned = 2;
    let lock = Promise.resolve();
    const act = async () => {
      const previous = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => (release = resolve));
      await previous;
      try {
        if (pinned >= 3) throw new Error("PIN_LIMIT_REACHED");
        pinned++;
        return { pinned: true };
      } finally {
        release();
      }
    };
    const handler = createThreadHandler({
      authenticate: async () => "account-1",
      act,
      list: async () => [],
    });
    const responses = await Promise.all([
      handler(request(), threadId, "pin"),
      handler(request(), threadId, "pin"),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(pinned).toBe(3);
  });

  it("passes a named mute duration to the server without calculating an expiry", async () => {
    const calls: unknown[] = [];
    const handler = createThreadHandler({
      authenticate: async () => "account-1",
      act: async (...args) => {
        calls.push(args);
        return { muted: true };
      },
      list: async () => [],
    });
    expect((await handler(request("8h"), threadId, "mute")).status).toBe(200);
    expect(calls[0]).toEqual(["account-1", threadId, "mute", "8h"]);
  });

  it("rejects an unknown mute duration", async () => {
    const handler = createThreadHandler({
      authenticate: async () => "account-1",
      act: async () => ({}),
      list: async () => [],
    });
    expect((await handler(request("tomorrow"), threadId, "mute")).status).toBe(400);
  });
});
