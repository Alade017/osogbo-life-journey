import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import mapData from "@/data/osogbo-map.json";

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
    render(<CityMapDashboard />);
    expect(
      screen.getByRole("group", { name: "Hand-placed Osogbo district map" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oja Oba, high traffic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Oja Oba Market/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Living Osogbo map")).not.toBeInTheDocument();
  });

  it("keeps eight hand-placed districts, review flags, and landmark spacing", () => {
    expect(mapData.districts).toHaveLength(8);
    expect(mapData.districts.slice(5).every((district) => district.verify === true)).toBe(true);
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
  });
});
