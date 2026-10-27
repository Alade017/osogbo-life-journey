import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));
import { runThreadAction, flushThreadActionQueue } from "@/lib/thread-preferences";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const thread = "33333333-3333-4333-8333-333333333333";
const key = (id: string) => `osun-life-thread-actions-v2:${id}`;
const session = (id: string) => ({
  data: { session: { access_token: `token-${id}`, user: { id } } },
});
const online = (value: boolean) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
const ok = () => new Response(JSON.stringify({ ok: true }));
beforeEach(() => {
  localStorage.clear();
  getSession.mockReset().mockResolvedValue(session(a));
  vi.stubGlobal("fetch", vi.fn().mockImplementation(ok));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("account-owned thread intent", () => {
  it("keeps intent when the session signs out between flush checks", async () => {
    online(false);
    await runThreadAction(thread, "pin", undefined, a);
    getSession
      .mockResolvedValueOnce(session(a))
      .mockResolvedValueOnce(session(a))
      .mockResolvedValueOnce({ data: { session: null } });
    expect(await flushThreadActionQueue(undefined, a)).toEqual({ sent: 0, remaining: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("serializes overlapping flushes without replaying a preference twice", async () => {
    online(false);
    await runThreadAction(thread, "pin", undefined, a);
    const results = await Promise.all([
      flushThreadActionQueue(undefined, a),
      flushThreadActionQueue(undefined, a),
    ]);
    expect(results).toEqual([
      { sent: 1, remaining: 0 },
      { sent: 1, remaining: 0 },
    ]);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("replays same-account offline actions using that account's token", async () => {
    online(false);
    await runThreadAction(thread, "mute", "8h", a);
    expect(fetch).not.toHaveBeenCalled();
    online(true);
    expect(await flushThreadActionQueue(undefined, a)).toEqual({ sent: 1, remaining: 0 });
    expect(fetch).toHaveBeenCalledWith(
      `/api/threads/${thread}/mute`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer token-${a}` }),
        body: JSON.stringify({ duration: "8h" }),
      }),
    );
  });
  it("does not replay A's actions as B, even for the same conversation", async () => {
    online(false);
    await runThreadAction(thread, "pin", undefined, a);
    getSession.mockResolvedValue(session(b));
    online(true);
    expect(await flushThreadActionQueue(undefined, b)).toEqual({ sent: 0, remaining: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key(a))!)).toHaveLength(1);
    await expect(runThreadAction(thread, "unpin", undefined, a)).rejects.toThrow(
      "CHAT_ACCOUNT_CHANGED",
    );
  });
  it("stops after a session switch during a flush and keeps remaining intent", async () => {
    online(false);
    await runThreadAction(thread, "pin", undefined, a);
    await runThreadAction(thread, "mute", "always", a);
    online(true);
    vi.mocked(fetch).mockImplementationOnce(async () => {
      getSession.mockResolvedValue(session(b));
      return ok();
    });
    expect(await flushThreadActionQueue(undefined, a)).toEqual({ sent: 1, remaining: 1 });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("discards ownerless and invalid stored actions", async () => {
    localStorage.setItem(
      "osun-life-thread-actions-v1",
      JSON.stringify([{ id: a, threadId: thread, command: "pin" }]),
    );
    localStorage.setItem(
      key(a),
      JSON.stringify([
        { id: a, threadId: thread, command: "delete-everything" },
        { id: a, threadId: thread, command: "mute", duration: "forever" },
        { id: "bad", threadId: thread, command: "pin" },
      ]),
    );
    await flushThreadActionQueue(undefined, a);
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem("osun-life-thread-actions-v1")).toBeNull();
    expect(localStorage.getItem(key(a))).toBe("[]");
  });
  it("retains network failures and retries without losing newly enqueued actions", async () => {
    online(false);
    await runThreadAction(thread, "pin", undefined, a);
    online(true);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("network"));
    expect(await flushThreadActionQueue(undefined, a)).toEqual({ sent: 0, remaining: 1 });
    vi.mocked(fetch).mockImplementationOnce(async () => {
      online(false);
      await runThreadAction(thread, "mute", "1w", a);
      return ok();
    });
    expect(await flushThreadActionQueue(undefined, a)).toEqual({ sent: 1, remaining: 1 });
    expect(JSON.parse(localStorage.getItem(key(a))!)[0].command).toBe("mute");
  });
  it("removes rejected intent and reports rejection", async () => {
    online(false);
    await runThreadAction(thread, "pin", undefined, a);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "PIN_LIMIT_REACHED" } }), { status: 409 }),
    );
    const rejected = vi.fn();
    expect(await flushThreadActionQueue(rejected, a)).toEqual({ sent: 0, remaining: 0 });
    expect(rejected).toHaveBeenCalledWith("PIN_LIMIT_REACHED");
  });
});
