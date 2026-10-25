import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimDailyTask,
  dailyTaskOptions,
  dailyTasksKey,
  getDailyTasks,
  parseDailyTasks,
} from "@/lib/daily-task-service";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const snapshot: import("@/lib/daily-task-service").DailyTaskSnapshot = {
  date: "2026-10-25",
  serverTime: "2026-10-25T22:59:59Z",
  resetsAt: "2026-10-25T23:00:00Z",
  tasks: [
    {
      key: "meal",
      title: "Complete a meal",
      action: "eat",
      rewardXp: 5,
      completed: true,
      claimed: false,
    },
  ],
};
beforeEach(() => vi.clearAllMocks());
describe("daily task service", () => {
  it("validates snapshots, bounded rewards, unique keys and claimed completion", () => {
    expect(parseDailyTasks(snapshot)).toEqual(snapshot);
    for (const bad of [
      null,
      { ...snapshot, date: "2026-02-30" },
      { ...snapshot, resetsAt: snapshot.serverTime },
      { ...snapshot, tasks: [snapshot.tasks[0], snapshot.tasks[0]] },
      ...[{ rewardXp: 50 }, { action: "invented" }, { claimed: true, completed: false }].map(
        (patch) => ({ ...snapshot, tasks: [{ ...snapshot.tasks[0], ...patch }] }),
      ),
    ]) {
      expect(() => parseDailyTasks(bad)).toThrow(/invalid daily tasks/);
    }
  });
  it("reads only a server-derived snapshot and scopes cache by account", async () => {
    rpc.mockResolvedValue({ data: snapshot, error: null });
    expect(await getDailyTasks()).toEqual(snapshot);
    expect(rpc).toHaveBeenCalledWith("get_daily_tasks");
    expect(dailyTasksKey("one")).not.toEqual(dailyTasksKey("two"));
  });
  it("sends only task and snapshot date and verifies claim response matches them", async () => {
    const result = {
      key: "meal",
      date: snapshot.date,
      rewardXp: 5,
      claimed: true,
      claimedAt: snapshot.serverTime,
    };
    rpc.mockResolvedValue({ data: result, error: null });
    expect(await claimDailyTask({ key: "meal", date: snapshot.date })).toEqual(result);
    expect(rpc).toHaveBeenCalledWith("claim_daily_task", {
      p_task_key: "meal",
      p_date: snapshot.date,
    });
    rpc.mockResolvedValue({ data: { ...result, key: "social" }, error: null });
    await expect(claimDailyTask({ key: "meal", date: snapshot.date })).rejects.toThrow(/invalid/);
  });
  it("preserves server rejections without fabricating success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Daily tasks have reset" } });
    await expect(claimDailyTask({ key: "meal", date: snapshot.date })).rejects.toThrow(/reset/);
    await expect(getDailyTasks()).rejects.toThrow(/reset/);
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Schema cache details" },
    });
    await expect(getDailyTasks()).rejects.toThrow(
      "Daily tasks are not available yet. Try again later.",
    );
  });
  it("refreshes at server reset using elapsed query age, independent of local timezone", () => {
    const interval = dailyTaskOptions("one").refetchInterval;
    expect(typeof interval).toBe("function");
    if (typeof interval !== "function") throw new Error("Expected reset interval");
    const query = { state: { data: snapshot, dataUpdatedAt: Date.now() } } as Parameters<
      typeof interval
    >[0];
    expect(interval(query)).toBe(1000);
    query.state.data = { ...snapshot, resetsAt: "2026-10-26T23:00:00Z" };
    expect(interval(query)).toBe(60_000);
  });
});
