import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const start = Date.parse("2026-10-26T12:00:00Z");
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/lib/multiplayer-service", () => ({ joinPartyRoom: vi.fn() }));
vi.mock("@/components/game/PartyHostResults", () => ({
  PartyHostResults: () => <p>Host results stay separate</p>,
}));
vi.mock("@/lib/game", () => ({
  formatNaira: (v: number) => String(v),
  q: {
    character: () => ({
      queryKey: ["fixtureCharacter"],
      queryFn: async () => ({ id: "host", user_id: "owner", current_location_id: "venue" }),
    }),
    wallet: () => ({ queryKey: ["fixtureWallet"], queryFn: async () => ({ balance: 0 }) }),
    locations: () => ({ queryKey: ["fixtureLocations"], queryFn: async () => [] }),
  },
}));
vi.mock("@/lib/party-service", () => ({
  getActiveClubVisit: async () => null,
  getDanceCooldown: async () => null,
  getPartyMood: async () => ({ score: 50 }),
  listPartyClubActivities: async () => [],
  listPartyDrinks: async () => [],
  listPartyVenues: async () => [],
  listPartyEvents: async () => [
    {
      id: "event",
      host_character_id: "host",
      location_id: "venue",
      title: "Clock fixture event",
      starts_at: "2026-10-26T12:01:00Z",
      ends_at: "2026-10-26T12:02:00Z",
      status: "scheduled",
      requirements: [],
    },
  ],
  newPartyRequestId: () => "fixture",
  partyRpc: { respondToEvent: vi.fn(), hostEvent: vi.fn() },
}));
import { PartyExperience } from "@/routes/_authenticated/_game/party";
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("refreshes the Events phase on timer/focus and releases its interval", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(start);
  const intervals = vi.spyOn(window, "setInterval");
  const clear = vi.spyOn(window, "clearInterval");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <PartyExperience initialTab="events" compact />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Clock fixture event")).toBeInTheDocument();
  expect(screen.queryByText("Live")).not.toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(61_000);
  });
  expect(await screen.findByText("Live")).toBeInTheDocument();
  vi.setSystemTime(start + 120_000);
  fireEvent(window, new Event("focus"));
  expect(await screen.findByText("No events yet")).toBeInTheDocument();
  const clockIndex = intervals.mock.calls.findIndex((call) => call[1] === 15_000);
  expect(clockIndex).toBeGreaterThanOrEqual(0);
  const timer = intervals.mock.results[clockIndex]!.value;
  view.unmount();
  expect(clear).toHaveBeenCalledWith(timer);
});
