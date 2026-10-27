import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const { read, claim, success } = vi.hoisted(() => ({
  read: vi.fn(),
  claim: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/lib/game", () => ({ formatNaira: (n: number) => `₦${n.toLocaleString("en-NG")}` }));
vi.mock("sonner", () => ({ toast: { success } }));
vi.mock("@/lib/stall-income-service", () => ({
  readStallIncome: read,
  claimStallIncome: claim,
  stallIncomeKey: (id: string) => ["stallIncome", id],
}));
import { StallIncomePanel } from "@/components/game/StallIncomePanel";
const snapshot = {
  serverTime: "2026-10-27T12:00:00Z",
  asOf: "2026-10-27T12:00:00Z",
  date: "2026-10-27",
  ratePerHour: 10,
  dailyCap: 100,
  retainedDates: 7,
  policyVersion: 1,
  hasStall: true,
  enrolled: true,
  isOpen: true,
  claimable: 10,
  todayEarned: 10,
  todayPaid: 0,
  lastReceipt: null,
};
let client: QueryClient;
function setup(userId = "owner") {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StallIncomePanel userId={userId} />
    </QueryClientProvider>,
  );
}
async function ready() {
  const button = await screen.findByRole("button", { name: "Claim stall income" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}
beforeEach(() => {
  vi.resetAllMocks();
  read.mockResolvedValue(snapshot);
});
afterEach(() => {
  cleanup();
  client?.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  onlineManager.setOnline(true);
});
describe("stall payout panel", () => {
  it("does not save or claim on mount and guards same-tick double clicks", async () => {
    let resolve!: (value: unknown) => void;
    claim.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    setup();
    const button = await ready();
    expect(claim).not.toHaveBeenCalled();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    expect(success).not.toHaveBeenCalled();
    const requestId = claim.mock.calls[0]![0] as string;
    const receipt = {
      requestId,
      amount: 10,
      transactionId: "transaction",
      cash: 110,
      claimedAt: snapshot.asOf,
      policyVersion: 1,
      duplicate: false,
    };
    read.mockResolvedValue({ ...snapshot, claimable: 0, todayPaid: 10, lastReceipt: receipt });
    await act(async () => resolve(receipt));
    expect(await screen.findByText("Last confirmed payout: ₦10")).toBeInTheDocument();
    expect(success).toHaveBeenCalledTimes(1);
  });
  it("reuses the same UUID after a failed response", async () => {
    claim.mockRejectedValue(new Error("Retry payout"));
    setup();
    fireEvent.click(await ready());
    fireEvent.click(await screen.findByRole("button", { name: "Retry claim" }));
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(2));
    expect(claim.mock.calls[0]).toEqual(claim.mock.calls[1]);
  });
  it("recovers a lost committed receipt without a second claim or duplicate toast", async () => {
    claim.mockImplementation(async (requestId: string) => {
      read.mockResolvedValue({
        ...snapshot,
        claimable: 0,
        lastReceipt: {
          requestId,
          amount: 10,
          cash: 110,
          transactionId: "tx",
          claimedAt: snapshot.asOf,
          policyVersion: 1,
        },
      });
      throw new Error("Response lost");
    });
    setup();
    fireEvent.click(await ready());
    expect(await screen.findByText("Last confirmed payout: ₦10")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalledTimes(1);
  });
  it("does not queue offline actions and labels cached amounts as estimates", async () => {
    setup();
    const button = await ready();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent(window, new Event("offline"));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(claim).not.toHaveBeenCalled();
    expect(await screen.findByText(/Previously loaded amounts are estimates/)).toBeInTheDocument();
  });
  it("uses persisted closed/enrollment state and keeps empty earnings non-paying", async () => {
    read.mockResolvedValue({
      ...snapshot,
      enrolled: false,
      isOpen: false,
      claimable: 0,
      todayEarned: 0,
    });
    setup();
    expect(await screen.findByText(/Save your stall once/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nothing to claim" })).toBeDisabled();
    expect(claim).not.toHaveBeenCalled();
  });
  it("makes missing-RPC failures retryable without creating a stall", async () => {
    read.mockRejectedValueOnce(new Error("Not available yet"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Not available yet");
    fireEvent.click(screen.getByRole("button", { name: "Retry income" }));
    expect(await screen.findByText("Estimated claimable: ₦10")).toBeInTheDocument();
    expect(claim).not.toHaveBeenCalled();
  });
  it("suppresses late confirmation after the owner panel unmounts", async () => {
    let resolve!: (value: unknown) => void;
    claim.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = setup();
    fireEvent.click(await ready());
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => resolve({ amount: 10, duplicate: false }));
    expect(success).not.toHaveBeenCalled();
  });
  it("never shows another account's cached income", async () => {
    read.mockResolvedValue({ ...snapshot, claimable: 0 });
    setup("other-owner");
    client.setQueryData(["stallIncome", "owner"], snapshot);
    expect(await screen.findByText("Estimated claimable: ₦0")).toBeInTheDocument();
    expect(screen.queryByText("Estimated claimable: ₦10")).not.toBeInTheDocument();
  });
});
