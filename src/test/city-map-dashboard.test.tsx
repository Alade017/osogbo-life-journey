import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import townData from "@/data/osogbo-town.json";
import { MapCanvas } from "@/components/map/MapCanvas";
import { findMapPlaceAction } from "@/lib/map-place-action.server";

beforeEach(() => {
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
afterEach(() => vi.unstubAllGlobals());

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CityMapDashboard />
    </QueryClientProvider>,
  );
}

describe("isometric town map", () => {
  it("renders the 3D canvas and a keyboard-accessible list when WebGL is unavailable", () => {
    const { container } = renderDashboard();
    expect(
      screen.getByRole("region", { name: "Interactive isometric town map" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3D requires WebGL. Your browser could not start it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Places on the map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Civic court, services/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /osogbo map/i })).not.toBeInTheDocument();
    expect(container.querySelector(".town-map-zoom-controls")).toBeInTheDocument();
  });

  it("defines a compact hand-authored grid and fictional public venues with action definitions", () => {
    expect(townData.meta.grid).toEqual({ columns: 14, rows: 10, cellSize: 2 });
    expect(townData.grid.rows).toHaveLength(10);
    expect(townData.grid.rows.every((row) => row.length === 14)).toBe(true);
    expect(townData.districts).toHaveLength(8);
    expect(townData.landmarks.map((place) => place.label)).toEqual(
      expect.arrayContaining([
        "Civic court",
        "Community police station",
        "Cedar Bank",
        "Meridian Bank",
        "Lantern Club",
      ]),
    );
    expect(townData.landmarks.every((place) => place.actions.length === 4)).toBe(true);
    expect(townData.landmarks.some((place) => place.category === "worship")).toBe(false);
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
    fireEvent.click(screen.getByRole("button", { name: /Civic court, services/i }));
    fireEvent.click(screen.getByRole("button", { name: "Billboard for Cedar Goods" }));
    expect(onSelectLandmark).toHaveBeenCalledWith("civic-court");
    expect(onSelectBillboard).toHaveBeenCalledWith("campaign-1");
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
