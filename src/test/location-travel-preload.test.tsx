import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated/_game/location.$slug";
import { peekPendingDepartureFromHome, takeDepartureFromHome } from "@/lib/home-departure";

const state = vi.hoisted(() => ({
  slug: "osun-mall",
  type: "commercial",
  balance: 1000,
  preload: vi.fn(),
  networkAllowed: vi.fn(),
  homeCheck: vi.fn(),
  travel: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({
    options,
    useParams: () => ({ slug: state.slug }),
  }),
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: state.error } }));
vi.mock("@/components/game/venue-preloader", () => ({ preloadVenueModule: state.preload }));
vi.mock("@/lib/venue-preload-policy", () => ({ canPreloadVenueInBrowser: state.networkAllowed }));
vi.mock("@/lib/home-departure-query", () => ({ hasConfirmedHomeDeparture: state.homeCheck }));
vi.mock("@/hooks/use-world-clock", () => ({ useWorldClock: () => ({ data: undefined }) }));
vi.mock("@/lib/seo", () => ({ pageMeta: vi.fn() }));
vi.mock("@/components/game/LocationVenueScene", () => ({
  LocationVenueScene: () => <div>Venue interior</div>,
}));
vi.mock("@/components/game/LocationActivities", () => ({ LocationActivities: () => null }));
vi.mock("@/components/game/CityEventParticipation", () => ({ CityEventParticipation: () => null }));
vi.mock("@/components/game/PartyVenuePanel", () => ({ PartyVenuePanel: () => null }));
vi.mock("@/components/game/ui", () => ({ EmptyState: () => null, LoadingState: () => null }));
vi.mock("@/lib/game", () => {
  const query = (key: string) => () => ({ queryKey: [key], queryFn: async () => [] });
  return {
    formatNaira: (value: number) => `₦${value}`,
    q: {
      locations: query("locations"),
      character: query("character"),
      wallet: query("wallet"),
      places: query("places"),
      jobs: query("jobs"),
      myJobs: query("myJobs"),
      educationCourses: query("courses"),
      myCourses: query("myCourses"),
      playerSkills: query("playerSkills"),
    },
    rpc: {
      visitLocation: vi.fn(),
      travelToLocation: state.travel,
      selectJob: vi.fn(),
      eatAtPlace: vi.fn(),
    },
    useGameAction: (mutate: unknown) => ({ mutate, isPending: false }),
  };
});

// Keep the route callbacks and state transitions; replace only the visual panel.
vi.mock("@/components/game/TravelPanel", () => ({
  TravelPanel: ({
    onStart,
    state: travelState,
  }: {
    onStart: () => void;
    state: { status: string };
  }) => (
    <div>
      <span>{travelState.status}</span>
      <button onClick={onStart}>Confirm travel</button>
    </div>
  ),
}));

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  state.slug = "osun-mall";
  state.type = "commercial";
  state.balance = 1000;
  state.preload.mockReset().mockResolvedValue(true);
  state.networkAllowed.mockReset().mockReturnValue(true);
  state.homeCheck.mockReset().mockResolvedValue(false);
  state.navigate.mockReset().mockResolvedValue(undefined);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  takeDepartureFromHome();
});
afterEach(() => {
  cleanup();
  client.clear();
  takeDepartureFromHome();
  vi.useRealTimers();
});

function show() {
  client.setQueryData(
    ["locations"],
    [
      {
        id: "destination",
        slug: state.slug,
        name: "Test destination",
        type: state.type,
        level_required: 1,
        travel_fare: 200,
        travel_minutes: 10,
        metadata: { available_transport_modes: ["danfo"] },
      },
    ],
  );
  client.setQueryData(["character"], {
    id: "player",
    current_location_id: "origin",
    level: 5,
  });
  client.setQueryData(["wallet"], { balance: state.balance });
  for (const key of ["places", "jobs", "myJobs", "courses", "myCourses", "playerSkills"]) {
    client.setQueryData([key], []);
  }
  const Page = Route.options.component!;
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}
function selectDestination() {
  fireEvent.click(screen.getByRole("button", { name: "Choose destination" }));
}
async function confirmTravel() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm travel" }));
  });
}
async function finishTravelTimer() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
}

it("does not preload while browsing a destination", () => {
  show();
  selectDestination();
  expect(state.preload).not.toHaveBeenCalled();
  expect(state.travel).not.toHaveBeenCalled();
});
it("preloads the selected venue with its location ID", async () => {
  show();
  selectDestination();
  await confirmTravel();
  expect(state.preload).toHaveBeenCalledTimes(1);
  expect(state.preload).toHaveBeenCalledWith("osun-mall", expect.any(Object), "destination");
  expect(state.travel).not.toHaveBeenCalled();
  await finishTravelTimer();
  expect(state.travel).toHaveBeenCalledTimes(1);
  expect(state.travel).toHaveBeenCalledWith({ locationId: "destination", mode: "danfo" });
});
it("does not preload when the player cannot afford travel", async () => {
  state.balance = 0;
  show();
  selectDestination();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.preload).not.toHaveBeenCalled();
  expect(state.travel).not.toHaveBeenCalled();
  expect(state.error).toHaveBeenCalled();
});
it("preserves travel when network policy blocks preloading", async () => {
  state.networkAllowed.mockReturnValue(false);
  show();
  selectDestination();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.preload).not.toHaveBeenCalled();
  expect(state.travel).toHaveBeenCalledTimes(1);
});
it("skips bank destinations using their separate route", async () => {
  state.slug = "cedar-bank";
  state.type = "bank";
  show();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.preload).not.toHaveBeenCalled();
  expect(state.travel).toHaveBeenCalledTimes(1);
});
it("preserves the home departure handoff", async () => {
  state.homeCheck.mockResolvedValue(true);
  show();
  selectDestination();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.navigate).toHaveBeenCalledWith({ to: "/house" });
  expect(peekPendingDepartureFromHome()).toEqual({ locationId: "destination", mode: "danfo" });
  expect(state.preload).not.toHaveBeenCalled();
  expect(state.travel).not.toHaveBeenCalled();
});
it("skips preload if home status verification fails", async () => {
  state.homeCheck.mockRejectedValue(new Error("Home status unavailable"));
  show();
  selectDestination();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.preload).not.toHaveBeenCalled();
  expect(state.travel).not.toHaveBeenCalled();
  expect(state.error).toHaveBeenCalled();
});
it("does not wait for preloading before submitting travel", async () => {
  state.preload.mockImplementation(() => new Promise<boolean>(() => {}));
  show();
  selectDestination();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.preload).toHaveBeenCalledTimes(1);
  expect(state.travel).toHaveBeenCalledTimes(1);
});
it("preserves travel when venue preloading fails", async () => {
  state.preload.mockResolvedValue(false);
  show();
  selectDestination();
  await confirmTravel();
  await finishTravelTimer();
  expect(state.preload).toHaveBeenCalledTimes(1);
  expect(state.travel).toHaveBeenCalledTimes(1);
});
