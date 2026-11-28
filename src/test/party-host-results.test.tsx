import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartyHostResults } from "@/components/game/PartyHostResults";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/lib/party-reward-service", () => ({
  readPartyHostResults: read,
  partyHostKey: (id: string) => ["partyHostResults", id],
}));

const event = {
  eventId: "11111111-1111-4111-8111-111111111111",
  title: "Fictional gathering",
  endsAt: "2026-10-26T15:00:00Z",
  claimUntil: "2026-11-02T15:00:00Z",
  requirements: 2,
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
  it("shows what happened at each hosted event with no claim or reward button", async () => {
    setup();
    expect(await screen.findByText("Fictional gathering")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText("2 guest accounts")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is paid out yet/)).toBeInTheDocument();
  });

  it("labels running and cancelled events", async () => {
    read.mockResolvedValue({
      ...snapshot,
      events: [
        { ...event, eventId: "a", title: "Running one", reason: "not_ended" },
        { ...event, eventId: "b", title: "Cancelled one", reason: "cancelled" },
      ],
    });
    setup();
    expect(await screen.findByText("Running now")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("keeps failures retryable", async () => {
    read.mockRejectedValueOnce(new Error("missing"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry results" }));
    expect(await screen.findByText("Fictional gathering")).toBeInTheDocument();
  });

  it("shows the empty state when nothing was hosted recently", async () => {
    read.mockResolvedValue({ ...snapshot, events: [] });
    setup();
    expect(await screen.findByText("No recent hosted events.")).toBeInTheDocument();
  });
});
