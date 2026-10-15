import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import mapData from "@/data/osogbo-map.json";
import { MapCanvas } from "@/components/map/MapCanvas";

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

describe("city map overview", () => {
  it("shows the hand-placed district map without the old geographic map", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CityMapDashboard />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("group", { name: "Hand-placed Osogbo district map" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oja Oba, high traffic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Oja Oba Market/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Living Osogbo map")).not.toBeInTheDocument();
  });

  it("keeps eight hand-placed districts, review flags, and landmark spacing", () => {
    expect(mapData.districts).toHaveLength(8);
    expect(
      mapData.districts
        .filter((district) => district.verify)
        .every((district) => district.verify === true),
    ).toBe(true);
    expect(mapData.excluded).toContainEqual({
      name: "Osun-Osogbo Sacred Grove",
      reason: "sacred site, not playable",
    });

    const landmarks = mapData.districts.flatMap((district) => district.landmarks);
    expect(landmarks.every(({ x, y }) => x >= 0 && x <= 1200 && y >= 0 && y <= 800)).toBe(true);
    for (let first = 0; first < landmarks.length; first += 1) {
      for (let second = first + 1; second < landmarks.length; second += 1) {
        expect(
          Math.hypot(
            landmarks[first]!.x - landmarks[second]!.x,
            landmarks[first]!.y - landmarks[second]!.y,
          ),
        ).toBeGreaterThanOrEqual(60);
      }
    }
    expect(landmarks).toHaveLength(8);
    expect(landmarks.every((landmark) => landmark.actions?.length === 4)).toBe(true);
    expect(landmarks.every((landmark) => landmark.source && landmark.isoCell)).toBe(true);
    expect(landmarks.some((landmark) => landmark.label === "Osogbo Sacred Grove")).toBe(false);
  });

  it("switches to the isometric renderer without changing map selection callbacks", () => {
    render(<MapCanvas onSelectDistrict={() => {}} onSelectLandmark={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Isometric" }));
    expect(
      screen.getByRole("group", { name: "Isometric Osogbo district map" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oja Oba, high traffic" })).toBeInTheDocument();
  });

  it("snaps mouse wheel input between the three supported zoom levels", () => {
    render(<MapCanvas onSelectDistrict={() => {}} onSelectLandmark={() => {}} />);
    const map = screen.getByRole("region", { name: "Interactive Osogbo map" });
    fireEvent.wheel(map, { deltaY: -40, clientX: 600, clientY: 400 });
    expect(map).toHaveAttribute("data-zoom-level", "2");
    fireEvent.wheel(map, { deltaY: 40, clientX: 600, clientY: 400 });
    expect(map).toHaveAttribute("data-zoom-level", "1");
  });
});
