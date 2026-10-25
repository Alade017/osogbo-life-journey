import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkInLogin,
  getLoginStreak,
  loginStreakKey,
  loginStreakOptions,
  parseLoginStreak,
  type LoginStreakSnapshot,
} from "@/lib/login-streak-service";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const data: LoginStreakSnapshot = {
  date: "2026-10-25",
  serverTime: "2026-10-25T22:59:59Z",
  resetsAt: "2026-10-25T23:00:00Z",
  streak: 0,
  todayClaimed: false,
  rewardXp: 5,
};
beforeEach(() => vi.clearAllMocks());
describe("login streak service", () => {
  it("validates dates, reset boundaries, reward caps and claimed counts", () => {
    expect(parseLoginStreak(data)).toEqual(data);
    for (const bad of [
      null,
      { ...data, date: "2026-02-30" },
      { ...data, resetsAt: data.serverTime },
      { ...data, rewardXp: 6 },
      { ...data, streak: -1 },
      { ...data, todayClaimed: true },
      { ...data, todayClaimed: "yes" },
    ])
      expect(() => parseLoginStreak(bad)).toThrow(/invalid daily check-in/);
  });
  it("sends only the server date and rejects mismatched or unconfirmed receipts", async () => {
    rpc.mockResolvedValue({
      data: {
        date: data.date,
        streak: 1,
        rewardXp: 5,
        claimedAt: data.serverTime,
        newlyAwarded: true,
      },
      error: null,
    });
    expect((await checkInLogin(data.date)).newlyAwarded).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_in_login", { p_date: data.date });
    for (const patch of [
      { date: "2026-10-26" },
      { rewardXp: 50 },
      { newlyAwarded: "yes" },
      { streak: 0 },
    ]) {
      rpc.mockResolvedValue({
        data: {
          date: data.date,
          streak: 1,
          rewardXp: 5,
          claimedAt: data.serverTime,
          newlyAwarded: true,
          ...patch,
        },
        error: null,
      });
      await expect(checkInLogin(data.date)).rejects.toThrow(/invalid/);
    }
  });
  it("reads server state, keeps account caches separate and uses server reset duration", async () => {
    rpc.mockResolvedValue({ data, error: null });
    expect(await getLoginStreak()).toEqual(data);
    expect(rpc).toHaveBeenCalledWith("get_login_streak");
    expect(loginStreakKey("a")).not.toEqual(loginStreakKey("b"));
    const interval = loginStreakOptions("a").refetchInterval;
    if (typeof interval !== "function") throw Error("Expected reset refresh");
    expect(
      interval({ state: { data, dataUpdatedAt: Date.now() } } as Parameters<typeof interval>[0]),
    ).toBe(1000);
  });
  it("preserves server rejection and hides missing-RPC implementation details", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "The check-in day has changed" } });
    await expect(checkInLogin(data.date)).rejects.toThrow(/day has changed/);
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "schema details" } });
    await expect(getLoginStreak()).rejects.toThrow(
      "Daily check-in is not available yet. Try again later.",
    );
  });
});
