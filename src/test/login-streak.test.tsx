import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginStreakProvider } from "@/components/game/LoginStreakProvider";
import { LoginStreakSummary } from "@/components/game/LoginStreakSummary";
import type { LoginStreakSnapshot } from "@/lib/login-streak-service";
const { read, check, toast } = vi.hoisted(() => ({
  read: vi.fn(),
  check: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: toast } }));
vi.mock("@/lib/login-streak-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/login-streak-service")>(
    "@/lib/login-streak-service",
  );
  return {
    ...actual,
    checkInLogin: check,
    loginStreakOptions: (uid: string) => ({ ...actual.loginStreakOptions(uid), queryFn: read }),
  };
});
const data: LoginStreakSnapshot = {
  date: "2026-10-25",
  serverTime: "2026-10-25T12:00:00Z",
  resetsAt: "2026-10-25T23:00:00Z",
  streak: 0,
  todayClaimed: false,
  rewardXp: 5,
};
const claimed = { ...data, streak: 1, todayClaimed: true };
const receipt = {
  date: data.date,
  streak: 1,
  rewardXp: 5,
  claimedAt: data.serverTime,
  newlyAwarded: true,
};
let client: QueryClient;
const clients: QueryClient[] = [];
function setup(characterId = "character") {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <LoginStreakProvider userId="account" characterId={characterId}>
          <p>Playable game</p>
          <LoginStreakSummary />
        </LoginStreakProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  onlineManager.setOnline(true);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  read.mockResolvedValue(structuredClone(data));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((q) => q.clear());
  onlineManager.setOnline(true);
  vi.useRealTimers();
});
describe("daily check-in controller", () => {
  it("does not read or award without a playable character", async () => {
    setup("");
    expect(read).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });
  it("recovers a lost response from the stored receipt without another reward notification", async () => {
    check.mockImplementation(async () => {
      read.mockResolvedValue(claimed);
      throw Error("Response lost");
    });
    setup();
    await screen.findByText(/Today's 5 XP received/);
    expect(check).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
  it("checks restored sessions once and displays XP only after confirmation", async () => {
    let resolve!: (v: unknown) => void;
    check.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    setup();
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    expect(read).toHaveBeenCalled();
    expect(check.mock.calls[0]![0]).toBe(data.date);
    expect(screen.queryByText(/XP received/)).toBeNull();
    expect(toast).not.toHaveBeenCalled();
    fireEvent(window, new Event("focus"));
    expect(check).toHaveBeenCalledTimes(1);
    read.mockResolvedValue(claimed);
    await act(async () => resolve(receipt));
    expect(await screen.findByText(/Today's 5 XP received/)).toBeVisible();
    expect(toast).toHaveBeenCalledTimes(1);
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["loginStreak", "account"] });
    });
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByText(/Today's 5 XP received/)).toBeVisible());
    expect(check).toHaveBeenCalledTimes(1);
  });
  it("does not mutate when today's receipt already exists, including after remount", async () => {
    read.mockResolvedValue(claimed);
    const view = setup();
    await screen.findByText(/Today's 5 XP received/);
    view.unmount();
    setup();
    await screen.findByText(/Today's 5 XP received/);
    expect(check).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
  it("suspends hidden/offline sessions and reads before check-in after reconnect", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    setup();
    expect(screen.getByText("Playable game")).toBeVisible();
    expect(check).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    const order: string[] = [];
    read.mockImplementation(async () => {
      order.push("read");
      return data;
    });
    check.mockImplementation(async () => {
      order.push("check");
      read.mockResolvedValue(claimed);
      return receipt;
    });
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent(window, new Event("online"));
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByText(/Today's 5 XP received/);
    expect(order[0]).toBe("read");
    expect(order).toContain("check");
    expect(check).toHaveBeenCalledTimes(1);
  });
  it("does not loop on failure and retries the same server date explicitly", async () => {
    check.mockRejectedValue(new Error("Check-in connection failed"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Check-in connection failed");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry daily check-in" })).toBeEnabled(),
    );
    expect(check).toHaveBeenCalledTimes(1);
    check.mockImplementation(async () => {
      read.mockResolvedValue(claimed);
      return receipt;
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry daily check-in" }));
    await screen.findByText(/Today's 5 XP received/);
    expect(check.mock.calls.map((c) => c[0])).toEqual([data.date, data.date]);
  });
  it("refreshes a stale date before checking in on the new day", async () => {
    const next = {
      ...data,
      date: "2026-10-26",
      serverTime: "2026-10-25T23:00:00Z",
      resetsAt: "2026-10-26T23:00:00Z",
    };
    check
      .mockImplementationOnce(async () => {
        read.mockResolvedValue(next);
        throw Error("The check-in day has changed");
      })
      .mockImplementationOnce(async () => {
        read.mockResolvedValue({ ...next, streak: 1, todayClaimed: true });
        return { ...receipt, date: next.date };
      });
    setup();
    await screen.findByText(/Today's 5 XP received/);
    expect(check.mock.calls.map((c) => c[0])).toEqual([data.date, next.date]);
  });
  it("keeps gameplay usable when the snapshot service is unavailable", async () => {
    read.mockRejectedValue(new Error("Daily check-in is not available yet. Try again later."));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("not available yet");
    expect(screen.getByText("Playable game")).toBeVisible();
    expect(check).not.toHaveBeenCalled();
  });
});
