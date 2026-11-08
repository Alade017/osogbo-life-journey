import { fireEvent, render, screen } from "@testing-library/react";
import { within } from "@testing-library/dom";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import townData from "@/data/osogbo-town.json";
import osunPlaces from "@/data/osun-public-places.json";
import { MapCanvas } from "@/components/map/MapCanvas";
import { findMapPlaceAction } from "@/lib/map-place-action.server";
import {
  clearPendingDepartureFromHome,
  peekPendingDepartureFromHome,
  takeDepartureFromHome,
} from "@/lib/home-departure";
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => testState.navigate,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode; className?: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});
const testState = vi.hoisted(() => ({
  navigate: vi.fn(),
  travelToLocation: vi.fn(),
  character: null as Record<string, unknown> | null,
  locations: [] as Record<string, unknown>[],
  wallet: null as Record<string, unknown> | null,
  insideHome: false,
}));
vi.mock("@/components/map/PhaserMapSurface", () => ({
  PhaserMapSurface: ({ onUnavailable }: { onUnavailable: () => void }) => {
    useEffect(() => onUnavailable(), [onUnavailable]);
    return null;
  },
}));
const eventState = vi.hoisted(() => ({
  events: [] as import("@/lib/city-event-service").CityEventOccurrence[],
}));
vi.mock("@/hooks/use-city-events", () => ({
  useCityEvents: () => ({ data: { events: eventState.events }, isError: false }),
}));

vi.mock("@/lib/map-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/map-api")>()),
  requestAvailableMapLandmarks: vi.fn(async () => [
    ...townData.landmarks.map((place) => place.id),
    "olaiya-junction",
    "oja-oba-market",
  ]),
  requestMapLandmark: vi.fn(async () => ({ landmark: { min_age: 0 } })),
}));
vi.mock("@/lib/game", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/game")>()),
  rpc: {
    ...(await importOriginal<typeof import("@/lib/game")>()).rpc,
    travelToLocation: testState.travelToLocation,
  },
  q: Object.fromEntries(
    [
      "character",
      "rentStatus",
      "jobs",
      "locations",
      "wallet",
      "billboards",
      "advertisements",
      "playerAdvertisements",
    ].map((name) => [
      name,
      () => ({
        queryKey: [name],
        queryFn: async () => {
          if (name === "character") return testState.character;
          if (name === "locations") return testState.locations;
          if (name === "wallet") return testState.wallet;
          return name === "rentStatus" ? null : [];
        },
      }),
    ]),
  ),
}));
vi.mock("@/hooks/use-world-clock", () => ({ useWorldClock: () => ({ data: null }) }));

const clients: QueryClient[] = [];

beforeEach(() => {
  eventState.events = [];
  testState.navigate.mockReset();
  testState.travelToLocation.mockReset();
  testState.character = null;
  testState.locations = [];
  testState.wallet = null;
  testState.insideHome = false;
  const pending = takeDepartureFromHome();
  if (pending) clearPendingDepartureFromHome(pending);
  class TestResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      this.callback(
        [{ contentRect: { width: 1200, height: 800 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
  clients.splice(0).forEach((client) => client.clear());
});

function renderDashboard(currentSlug?: string, insideHome = false) {
  testState.insideHome = insideHome;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (currentSlug) {
    testState.character = {
      id: "test-character",
      user_id: "test-account",
      current_location_id: "confirmed-location",
      level: 5,
      inside_home_property_id: insideHome ? "player-property" : null,
    };
    testState.locations = [
      { id: "confirmed-location", slug: currentSlug, name: "Current location" },
      {
        id: "destination-city-centre",
        slug: "city-centre",
        name: "City Centre",
        travel_fare: 100,
        travel_minutes: 10,
        level_required: 1,
        metadata: { available_transport_modes: ["walking", "danfo"] },
      },
      {
        id: "destination-oja-oba",
        slug: "oja-oba",
        name: "Oja-Oba Market",
        travel_fare: 100,
        travel_minutes: 10,
        level_required: 1,
        metadata: { available_transport_modes: ["walking", "danfo"] },
      },
      {
        id: "destination-cedar-bank",
        slug: "cedar-bank",
        name: "Cedar Bank",
        travel_fare: 100,
        travel_minutes: 10,
        level_required: 1,
        metadata: { available_transport_modes: ["walking", "danfo"] },
      },
    ];
    testState.wallet = { balance: 10000 };
    queryClient.setQueryDefaults(["character"], { staleTime: Infinity });
    queryClient.setQueryDefaults(["locations"], { staleTime: Infinity });
    queryClient.setQueryData(["character"], testState.character);
    queryClient.setQueryData(["locations"], testState.locations);
    queryClient.setQueryData(["wallet"], testState.wallet);
  }
  clients.push(queryClient);
  queryClient.setQueryData(
    ["mapAvailableLandmarks"],
    [...townData.landmarks.map((place) => place.id), "olaiya-junction", "oja-oba-market"],
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <CityMapDashboard />
    </QueryClientProvider>,
  );
}

describe("isometric town map", () => {
  it("offers the market walking route only after confirmed arrival", () => {
    renderDashboard("oja-oba");
    expect(screen.getByRole("link", { name: "Walk Oja-Oba Market" })).toHaveAttribute(
      "href",
      "/neighborhood",
    );
    expect(screen.queryByRole("link", { name: "Walk Olaiya" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Visit Oja-Oba Market" })).not.toBeInTheDocument();
  });

  it("offers the transport selector rather than walking when another district is confirmed", async () => {
    renderDashboard("student-district");
    fireEvent.click(screen.getByRole("button", { name: "Visit Oja-Oba Market" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Walk Oja-Oba Market" })).not.toBeInTheDocument();
  }, 15_000);

  it("matches a selected venue with its server event landmark ID", async () => {
    eventState.events = [
      {
        occurrenceId: "market-week",
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
    ];
    renderDashboard();
    fireEvent.click(
      within(screen.getByRole("list", { name: "Places on the map" })).getByRole("button", {
        name: /Town market,/i,
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Place details and activities" }));
    expect(await screen.findByText(/Town Market Day · Until/)).toBeVisible();
  });

  it("opens the transport selector on landmark selection and cancellation does not travel", async () => {
    renderDashboard("residential");
    fireEvent.click(screen.getByRole("button", { name: "Travel to Olaiya" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(testState.travelToLocation).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }, 15_000);

  it("sends one RPC with the selected mode and navigates only after saved location refresh", async () => {
    renderDashboard("residential");
    testState.travelToLocation.mockImplementation(
      async ({ locationId }: { locationId: string; mode: string }) => {
        testState.character = {
          ...testState.character,
          current_location_id: locationId,
        };
        return { location: "city-centre" };
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Travel to Olaiya" }));
    await screen.findByText("Destination access confirmed.");
    fireEvent.click(screen.getByRole("radio", { name: /Danfo/ }));
    const confirmButton = screen.getByRole("button", { name: "Confirm and travel" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await vi.waitFor(() => {
      expect(testState.travelToLocation).toHaveBeenCalledTimes(1);
      expect(testState.navigate).toHaveBeenCalledWith({ to: "/neighborhood" });
    });
    expect(testState.travelToLocation).toHaveBeenCalledWith({
      locationId: "destination-city-centre",
      mode: "danfo",
    });
  }, 15_000);

  it("keeps the player on the map after failed travel", async () => {
    renderDashboard("residential");
    testState.travelToLocation.mockRejectedValueOnce(new Error("INSUFFICIENT_FUNDS"));
    fireEvent.click(screen.getByRole("button", { name: "Travel to Olaiya" }));
    await screen.findByText("Destination access confirmed.");
    fireEvent.click(screen.getByRole("radio", { name: /Danfo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and travel" }));

    await vi.waitFor(() => expect(testState.travelToLocation).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("INSUFFICIENT_FUNDS");
    expect(testState.navigate).not.toHaveBeenCalled();
    expect(testState.character?.["current_location_id"]).toBe("confirmed-location");
  }, 15_000);

  it("clears the queued home departure when navigation to the house fails", async () => {
    renderDashboard("residential", true);
    testState.navigate.mockRejectedValueOnce(new Error("navigation failed"));
    fireEvent.click(screen.getByRole("button", { name: "Travel to Olaiya" }));
    await screen.findByText("Destination access confirmed.");
    fireEvent.click(screen.getByRole("radio", { name: /Danfo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and travel" }));

    await vi.waitFor(() =>
      expect(testState.navigate).toHaveBeenCalledWith({ to: "/house" }),
    );
    await vi.waitFor(() => expect(peekPendingDepartureFromHome()).toBeNull());
    expect(testState.travelToLocation).not.toHaveBeenCalled();
  }, 15_000);

  it("preserves the queued home departure after successful navigation", async () => {
    renderDashboard("residential", true);
    testState.navigate.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Travel to Olaiya" }));
    await screen.findByText("Destination access confirmed.");
    fireEvent.click(screen.getByRole("radio", { name: /Danfo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and travel" }));

    await vi.waitFor(() =>
      expect(testState.navigate).toHaveBeenCalledWith({ to: "/house" }),
    );
    expect(takeDepartureFromHome()).toEqual({
      locationId: "destination-city-centre",
      mode: "danfo",
    });
    expect(testState.travelToLocation).not.toHaveBeenCalled();
  }, 15_000);

  it("offers the playable neighborhood for an active destination with a valid row", async () => {
    renderDashboard("residential");
    fireEvent.click(
      within(screen.getByRole("list", { name: "Places on the map" })).getByRole("button", {
        name: /Cedar Bank,/i,
      }),
    );
    await screen.findByRole("button", { name: "Confirm and travel" });
    expect(screen.queryByText(/does not have a playable neighborhood/i)).not.toBeInTheDocument();
    expect(testState.travelToLocation).not.toHaveBeenCalled();
  }, 15_000);
  it("renders the Phaser overview fallback and a keyboard-accessible list", async () => {
    const { container } = renderDashboard();
    expect(
      screen.getByRole("region", { name: /Interactive isometric town map/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Illustrated town map fallback" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Places on the map" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Places on the map" })).getByRole("button", {
        name: /Civic court, services/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Travel to Olaiya" })).toBeInTheDocument();
    expect(container.querySelector(".town-map-phaser-host")).not.toBeInTheDocument();
  });

  it("defines a compact hand-authored grid and fictional public venues with action definitions", () => {
    expect(townData.meta.grid).toEqual({ columns: 24, rows: 18, cellSize: 2 });
    expect(townData.grid.rows).toHaveLength(18);
    expect(townData.grid.rows.every((row) => row.length === 24)).toBe(true);
    expect(townData.districts).toHaveLength(11);
    expect(townData.landmarks.map((place) => place.label)).toEqual(
      expect.arrayContaining([
        "Civic court",
        "Community police station",
        "Cedar Bank",
        "Meridian Bank",
        "Lantern Club",
      ]),
    );
    // Expanded venues intentionally have one server-defined activity each.
    for (const place of townData.landmarks) {
      expect(place.actions.length).toBeGreaterThan(0);
      expect(new Set(place.actions.map((action) => action.id)).size).toBe(place.actions.length);
      for (const action of place.actions) {
        expect(findMapPlaceAction(place.id, action.id)).not.toBeNull();
      }
    }
    expect(
      townData.landmarks.filter((place) => place.category === "worship").map((place) => place.id),
    ).toEqual(["garden-chapel", "mosque-square"]);
    expect(JSON.stringify(townData)).not.toMatch(/\/models\/city\//);
    expect(JSON.stringify(townData).toLowerCase()).not.toMatch(/sacred|grove|osun-osogbo/);
    expect(townData.landmarks.find((place) => place.id === "lantern-club")?.min_age).toBe(18);
  });

  it("opens the selected place from the accessible list and retains billboard callbacks", () => {
    const onSelectLandmark = vi.fn();
    const onSelectBillboard = vi.fn();
    render(
      <MapCanvas
        onSelectDistrict={() => {}}
        onSelectLandmark={onSelectLandmark}
        billboardMarkers={[
          {
            campaignId: "campaign-1",
            landmarkId: "cedar-bank",
            advertiserName: "Cedar Goods",
            count: 2,
          },
        ]}
        onSelectBillboard={onSelectBillboard}
      />,
    );
    fireEvent.click(
      within(screen.getByRole("list", { name: "Places on the map" })).getByRole("button", {
        name: /Civic court, services/i,
      }),
    );
    fireEvent.click(
      within(screen.getByRole("list", { name: "Places on the map" })).getByRole("button", {
        name: "Billboard for Cedar Goods",
      }),
    );
    expect(onSelectLandmark).toHaveBeenCalledWith("civic-court");
    expect(onSelectBillboard).toHaveBeenCalledWith("campaign-1");
  });

  it("shows only public venue categories for towns outside the detailed Osogbo map", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Explore Osun" }));
    fireEvent.click(screen.getByRole("button", { name: "Ilesa" }));
    expect(screen.getByRole("heading", { name: "Ilesa" })).toBeInTheDocument();
    expect(screen.getByText("Town supermarket")).toBeInTheDocument();
    expect(screen.getByText("Community club")).toBeInTheDocument();
    const allowed = new Set(["supermarket", "club", "court", "phone_store"]);
    expect(
      osunPlaces.towns
        .filter((town) => !town.detailed)
        .every((town) => town.publicPlaces.every((place) => allowed.has(place.category))),
    ).toBe(true);
  });

  it("keeps each venue action server-defined and gates the club on the server landmark record", () => {
    expect(findMapPlaceAction("civic-court", "court-ask-clerk")?.action.requirement).toBe(
      "Travel here first",
    );
    expect(findMapPlaceAction("cedar-bank", "cedar-budgeting")).not.toBeNull();
    expect(findMapPlaceAction("lantern-club", "club-social")).not.toBeNull();
    expect(findMapPlaceAction("lantern-club", "made-up-action")).toBeNull();
  });
});
