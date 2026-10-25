import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityEventParticipation } from "@/components/game/CityEventParticipation";
import { WorldEnvironment } from "@/components/game/WorldEnvironment";
import type { CityEventSnapshot } from "@/lib/city-event-service";
const { read, join, toast } = vi.hoisted(() => ({ read: vi.fn(), join: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/use-city-events", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    useCityEvents: () =>
      useQuery({ queryKey: ["cityEvents", "account", "character"], queryFn: read, retry: false }),
  };
});
vi.mock("@/lib/city-event-service", async () => ({
  ...(await vi.importActual<typeof import("@/lib/city-event-service")>("@/lib/city-event-service")),
  joinCityEventOccurrence: join,
}));
vi.mock("@/hooks/use-world-clock", () => ({
  useWorldClock: () => ({ data: { day: 301, weekday: 2, hour: 10, minute: 0 } }),
}));
vi.mock("@/hooks/use-game-audio-events", () => ({ useGameAudioEvents: () => {} }));
vi.mock("@/components/game/LiveOsogboWeather", () => ({ LiveOsogboWeather: () => null }));
vi.mock("sonner", () => ({ toast: { message: toast, success: toast } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: React.PropsWithChildren<{ params: { slug: string } }>) => (
    <a href={`/location/${params.slug}`}>{children}</a>
  ),
}));
const data: CityEventSnapshot = {
  serverTime: "2026-10-28T08:00:00Z",
  events: [
    {
      occurrenceId: "one",
      id: "market-day",
      title: "Town Market Day",
      description: "Meet neighbours.",
      locationSlug: "town-market",
      locationName: "Town Market",
      landmarkId: "town-market",
      districtId: "market-quarter",
      startsAt: "2026-10-28T08:00:00Z",
      endsAt: "2026-10-28T15:00:00Z",
      status: "active",
      joined: false,
    },
  ],
};
let client: QueryClient;
function setup(element = <CityEventParticipation slug="town-market" isHere />) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(structuredClone(data));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => client?.clear());
describe("server-driven event displays", () => {
  it("restores joined attendance from the server after remount", async () => {
    read.mockResolvedValue({ ...data, events: [{ ...data.events[0]!, joined: true }] });
    const view = setup();
    expect(await screen.findByRole("button", { name: "Joined" })).toBeDisabled();
    view.unmount();
    setup();
    expect(await screen.findByRole("button", { name: "Joined" })).toBeDisabled();
    expect(join).not.toHaveBeenCalled();
  });
  it("submits one pinned occurrence and waits for the refreshed attendance", async () => {
    let resolve!: (value: unknown) => void;
    join.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    setup();
    const button = await screen.findByRole("button", { name: "Join event" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(join.mock.calls[0]![0]).toBe("one");
    expect(screen.queryByRole("button", { name: "Joined" })).toBeNull();
    read.mockResolvedValue({ ...data, events: [{ ...data.events[0]!, joined: true }] });
    await act(async () => resolve({ joined: true, duplicate: false }));
    expect(await screen.findByRole("button", { name: "Joined" })).toBeDisabled();
  });
  it("shows expiry rejection and refreshes without automatically joining another event", async () => {
    join.mockRejectedValue(new Error("This event is not active"));
    setup();
    const button = await screen.findByRole("button", { name: "Join event" });
    read.mockRejectedValue(new Error("Schedule unavailable"));
    fireEvent.click(button);
    expect(await screen.findByText("Schedule unavailable")).toBeVisible();
    expect(join).toHaveBeenCalledTimes(1);
  });
  it("shows upcoming, cancelled and unavailable states without join controls", async () => {
    const view = setup();
    await screen.findByRole("button", { name: "Join event" });
    for (const status of ["upcoming", "cancelled", "unavailable"] as const) {
      await act(async () => {
        client.setQueryData(["cityEvents", "account", "character"], {
          ...data,
          events: [{ ...data.events[0]!, status }],
        });
      });
      expect(screen.queryByRole("button", { name: "Join event" })).toBeNull();
      expect(screen.getByRole("heading", { name: "Town Market Day" })).toBeVisible();
    }
    view.unmount();
  });
  it("blocks offline joins and guides players who have not travelled", async () => {
    const view = setup();
    const button = await screen.findByRole("button", { name: "Join event" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent(window, new Event("offline"));
    expect(button).toBeDisabled();
    expect(join).not.toHaveBeenCalled();
    view.unmount();
    setup(<CityEventParticipation slug="town-market" isHere={false} />);
    expect(await screen.findByText("Travel here, then join the event.")).toBeVisible();
  });
  it("links server venues and announces each transition only once across refreshes", async () => {
    read.mockResolvedValue({ ...data, events: [] });
    setup(<WorldEnvironment />);
    await screen.findByText("No upcoming city events");
    await act(async () => {
      client.setQueryData(["cityEvents", "account", "character"], data);
    });
    expect(screen.getByRole("link", { name: /Town Market Day/ })).toHaveAttribute(
      "href",
      "/location/town-market",
    );
    expect(toast).toHaveBeenCalledTimes(1);
    await act(async () => {
      client.setQueryData(["cityEvents", "account", "character"], structuredClone(data));
    });
    expect(toast).toHaveBeenCalledTimes(1);
    await act(async () => {
      client.setQueryData(["cityEvents", "account", "character"], { ...data, events: [] });
    });
    expect(toast).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenLastCalledWith("Town Market Day has ended.");
  });
});
