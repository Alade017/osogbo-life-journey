import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyTasks } from "@/components/game/DailyTasks";
const { read, claim, toast } = vi.hoisted(() => ({
  read: vi.fn(),
  claim: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: toast } }));
vi.mock("@/lib/daily-task-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/daily-task-service")>(
    "@/lib/daily-task-service",
  );
  return {
    ...actual,
    claimDailyTask: claim,
    dailyTaskOptions: (uid: string) => ({
      queryKey: ["dailyTasks", uid],
      queryFn: read,
      retry: false,
    }),
  };
});
const data = {
  date: "2026-10-25",
  serverTime: "2026-10-25T12:00:00Z",
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
    {
      key: "study",
      title: "Complete a study session",
      action: "study",
      rewardXp: 5,
      completed: false,
      claimed: false,
    },
    {
      key: "social",
      title: "Complete a social activity",
      action: "socialize",
      rewardXp: 5,
      completed: true,
      claimed: true,
    },
  ],
};
let client: QueryClient;
function setup() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DailyTasks userId="account-one" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(structuredClone(data));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => client?.clear());
describe("daily tasks interface", () => {
  it("shows server progress, disables incomplete/claimed tasks and scopes the query", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Claim Complete a meal" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Claim Complete a study session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Claim Complete a social activity" })).toBeDisabled();
    expect(client.getQueryData(["dailyTasks", "account-one"])).toEqual(data);
  });
  it("submits once while pending and reports XP only after confirmation", async () => {
    let resolve!: (value: unknown) => void;
    claim.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    setup();
    const button = await screen.findByRole("button", { name: "Claim Complete a meal" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    expect(claim).toHaveBeenCalledWith({ key: "meal", date: data.date }, expect.anything());
    expect(toast).not.toHaveBeenCalled();
    await act(async () => resolve({ key: "meal", date: data.date, rewardXp: 5, claimed: true }));
    expect(await screen.findByText("Reward claimed: +5 XP")).toBeVisible();
    expect(toast).toHaveBeenCalledTimes(1);
  });
  it("refreshes after stale-day rejection without silently claiming tomorrow", async () => {
    claim.mockRejectedValue(new Error("Daily tasks have reset. Refresh and try again."));
    setup();
    const button = await screen.findByRole("button", { name: "Claim Complete a meal" });
    read.mockResolvedValue({ ...data, date: "2026-10-26" });
    fireEvent.click(button);
    expect(await screen.findByText(/Daily tasks have reset/)).toBeVisible();
    await waitFor(() => expect(screen.getByText(/Today: 2026-10-26/)).toBeVisible());
    expect(claim).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
  it("retries a failed claim with the same task and day", async () => {
    claim.mockRejectedValue(new Error("Connection lost"));
    setup();
    const button = await screen.findByRole("button", { name: "Claim Complete a meal" });
    fireEvent.click(button);
    await screen.findByText("Connection lost");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(2));
    expect(claim.mock.calls[0]![0]).toEqual(claim.mock.calls[1]![0]);
  });
  it("blocks offline claims and displays read failures with a retry control", async () => {
    read.mockRejectedValue(new Error("Tasks unavailable"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Tasks unavailable");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("button", { name: "Refresh daily tasks" })).toBeDisabled();
    expect(claim).not.toHaveBeenCalled();
  });
});
