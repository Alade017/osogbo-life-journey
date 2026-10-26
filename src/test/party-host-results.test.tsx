import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartyHostResults } from "@/components/game/PartyHostResults";
const { read, claim, toast } = vi.hoisted(() => ({
  read: vi.fn(),
  claim: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: toast } }));
vi.mock("@/lib/party-reward-service", () => ({
  readPartyHostResults: read,
  claimPartyHostReward: claim,
  partyHostKey: (id: string) => ["partyHostResults", id],
}));
const eventId = "11111111-1111-4111-8111-111111111111";
const event = {
  eventId,
  title: "Fictional gathering",
  endsAt: "2026-10-26T15:00:00Z",
  claimUntil: "2026-11-02T15:00:00Z",
  requirements: 1,
  completed: 1,
  guests: 2,
  reason: "eligible",
  receipt: null,
};
const snapshot = {
  serverTime: "2026-10-26T16:00:00Z",
  date: "2026-10-26",
  reward: 1,
  events: [event],
};
const receipt = {
  eventId,
  date: snapshot.date,
  reputationDelta: 1,
  reputationAfter: 11,
  newlyAwarded: true,
};
let client: QueryClient;
function setup() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PartyHostResults userId="owner" />
    </QueryClientProvider>,
  );
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
describe("host party results", () => {
  it("pins the server day and prevents double submission while pending", async () => {
    let confirm!: (value: unknown) => void;
    claim.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    setup();
    const button = await screen.findByRole("button", { name: "Claim reputation" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    expect(claim).toHaveBeenCalledWith({ eventId, date: snapshot.date });
    expect(toast).not.toHaveBeenCalled();
    read.mockResolvedValue({ ...snapshot, events: [{ ...event, reason: "claimed", receipt }] });
    await act(async () => confirm(receipt));
    expect(await screen.findByText(/Reward claimed/)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledTimes(1);
  });
  it("refreshes after rejection and requires another user click for a new date", async () => {
    claim.mockRejectedValue(new Error("The Lagos day changed."));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Claim reputation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Lagos day changed");
    expect(claim).toHaveBeenCalledTimes(1);
  });
  it("does not queue an offline claim", async () => {
    setup();
    const button = await screen.findByRole("button", { name: "Claim reputation" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent(window, new Event("offline"));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(claim).not.toHaveBeenCalled();
  });
  it("recovers a committed reward without a second toast or automatic claim", async () => {
    claim.mockRejectedValue(new Error("Response lost"));
    setup();
    const button = await screen.findByRole("button", { name: "Claim reputation" });
    read.mockResolvedValue({ ...snapshot, events: [{ ...event, reason: "claimed", receipt }] });
    fireEvent.click(button);
    expect(await screen.findByText(/Reward claimed/)).toBeInTheDocument();
    expect(claim).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps failures retryable without hiding the rest of the party screen", async () => {
    read.mockRejectedValueOnce(new Error("missing"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry results" }));
    expect(await screen.findByRole("button", { name: "Claim reputation" })).toBeEnabled();
  });
  it("suppresses a late success toast after the owner view unmounts", async () => {
    let confirm!: (value: unknown) => void;
    claim.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const view = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Claim reputation" }));
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => confirm(receipt));
    expect(toast).not.toHaveBeenCalled();
  });
});
