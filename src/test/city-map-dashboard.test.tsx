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
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode; className?: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});
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
  requestAvailableMapLandmarks: vi.fn(async () => townData.landmarks.map((place) => place.id)),
}));
vi.mock("@/lib/game", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/game")>()),
  q: Object.fromEntries(
    [
      "character",
      "rentStatus",
      "jobs",
      "locations",
      "billboards",
      "advertisements",
      "playerAdvertisements",
    ].map((name) => [
      name,
      () => ({
        queryKey: [name],
        queryFn: async () => (name === "character" || name === "rentStatus" ? null : []),
      }),
    ]),
  ),
}));
vi.mock("@/hooks/use-world-clock", () => ({ useWorldClock: () => ({ data: null }) }));

const clients: QueryClient[] = [];

beforeEach(() => {
  eventState.events = [];
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

function renderDashboard(currentSlug?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (currentSlug) {
    queryClient.setQueryDefaults(["character"], { staleTime: Infinity });
    queryClient.setQueryDefaults(["locations"], { staleTime: Infinity });
    queryClient.setQueryData(["character"], { current_location_id: "confirmed-location" });
    queryClient.setQueryData(["locations"], [{ id: "confirmed-location", slug: currentSlug }]);
  }
  clients.push(queryClient);
  queryClient.setQueryData(
    ["mapAvailableLandmarks"],
    [...townData.landmarks.map((place) => place.id), "olaiya-junction"],
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

  it("offers travel rather than walking when another district is confirmed", () => {
    renderDashboard("student-district");
    expect(screen.getByRole("link", { name: "Visit Oja-Oba Market" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Walk Oja-Oba Market" })).not.toBeInTheDocument();
  });

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
    expect(await screen.findByText(/Town Market Day · Until/)).toBeVisible();
  });
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
