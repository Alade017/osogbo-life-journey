import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "@/lib/request-timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value when the request answers in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, "late")).resolves.toBe(7);
  });

  it("rejects with the message when the request hangs, so the sync lock is released", async () => {
    vi.useFakeTimers();
    const hung = new Promise<number>(() => undefined);
    const result = withTimeout(hung, 500, "The game server did not answer in time. Retrying.");
    const assertion = expect(result).rejects.toThrow("did not answer in time");
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("passes through a rejection from the request itself", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("RPC failed")), 1000, "late"),
    ).rejects.toThrow("RPC failed");
  });
});
