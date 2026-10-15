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
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
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
    expect(screen.getByRole("group", { name: "Isometric Osogbo town map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oja Oba, high traffic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Oja oba market/i })).toBeInTheDocument();
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
    expect(landmarks).toHaveLength(10);
    expect(landmarks.every((landmark) => landmark.actions?.length === 4)).toBe(true);
    expect(landmarks.every((landmark) => landmark.source && landmark.isoCell)).toBe(true);
    expect(landmarks.some((landmark) => landmark.label === "Osogbo Sacred Grove")).toBe(false);
    for (const district of mapData.districts) {
      expect(district.buildings).toHaveLength(district.landmarks.length);
      expect(district.buildings?.every((building) => building.position && building.footprint)).toBe(
        true,
      );
      expect(district.props?.every((prop) => prop.interactive === false)).toBe(true);
    }
    expect(landmarks.map((landmark) => landmark.label)).toContain("Township food court");
    expect(landmarks.map((landmark) => landmark.label)).toContain("Osogbo Grand Mosque");
  });

  it("switches to the isometric renderer without changing map selection callbacks", () => {
    render(<MapCanvas onSelectDistrict={() => {}} onSelectLandmark={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    expect(
      screen.getByRole("group", { name: "Hand-placed Osogbo district map" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Isometric" }));
    expect(screen.getByRole("group", { name: "Isometric Osogbo town map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oja Oba, high traffic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Oja oba market/i })).toHaveAttribute(
      "data-building-category",
      "market",
    );
  });

  it("shows category buildings and icons at overview, then readable names at street zoom", () => {
    const { container } = render(
      <MapCanvas onSelectDistrict={() => {}} onSelectLandmark={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Oja oba market/i })).toBeInTheDocument();
    expect(container.querySelectorAll(".map-district-overlay-label")).toHaveLength(8);
    expect(container.querySelector(".map-building-label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Street" }));
    expect(container.querySelector(".map-building-label")).not.toBeNull();
  });

  it("snaps mouse wheel input between the three supported zoom levels", () => {
    render(<MapCanvas onSelectDistrict={() => {}} onSelectLandmark={() => {}} />);
    const map = screen.getByRole("region", { name: "Interactive Osogbo map" });
    fireEvent.wheel(map, { deltaY: -40, clientX: 600, clientY: 400 });
    expect(map).toHaveAttribute("data-zoom-level", "2");
    fireEvent.wheel(map, { deltaY: 40, clientX: 600, clientY: 400 });
    expect(map).toHaveAttribute("data-zoom-level", "1");
  });

  it("keeps a quick marker tap actionable and prevents a pan from opening its sheet", () => {
    const onSelectBillboard = vi.fn();
    const billboardMarkers = [
      {
        campaignId: "campaign-1",
        landmarkId: "oke-fia-flyover",
        advertiserName: "Aladtech",
        count: 1,
      },
    ];
    render(
      <MapCanvas
        onSelectDistrict={() => {}}
        onSelectLandmark={() => {}}
        billboardMarkers={billboardMarkers}
        onSelectBillboard={onSelectBillboard}
      />,
    );
    const map = screen.getByRole("region", { name: "Interactive Osogbo map" });
    const marker = screen.getByRole("button", { name: "Billboard for Aladtech" });
    Object.defineProperty(map, "setPointerCapture", { value: vi.fn(), configurable: true });

    fireEvent.pointerDown(marker, { pointerId: 4, button: 0, clientX: 350, clientY: 250 });
    fireEvent.pointerUp(map, { pointerId: 4, button: 0, clientX: 352, clientY: 251 });
    fireEvent.click(marker, { detail: 1 });
    expect(onSelectBillboard).toHaveBeenCalledTimes(1);

    onSelectBillboard.mockClear();
    fireEvent.pointerDown(marker, { pointerId: 5, button: 0, clientX: 350, clientY: 250 });
    fireEvent.pointerMove(map, { pointerId: 5, button: 0, clientX: 370, clientY: 250 });
    fireEvent.pointerUp(map, { pointerId: 5, button: 0, clientX: 370, clientY: 250 });
    fireEvent.click(marker, { detail: 1 });
    expect(onSelectBillboard).not.toHaveBeenCalled();
  });

  it("continues to update the map transform during pan and pinch gestures", () => {
    const renderMap = () => {
      class TestResizeObserver {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe() {
          this.callback(
            [{ contentRect: { width: 700, height: 500 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        disconnect() {}
        unobserve() {}
      }
      vi.stubGlobal("ResizeObserver", TestResizeObserver);
      return render(<MapCanvas onSelectDistrict={() => {}} onSelectLandmark={() => {}} />);
    };
    const { container } = renderMap();
    const map = screen.getByRole("region", { name: "Interactive Osogbo map" });
    Object.defineProperty(map, "setPointerCapture", { value: vi.fn(), configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Street" }));
    const transform = container.querySelector<HTMLElement>(".map-canvas-transform")!;
    const beforePan = transform.style.transform;
    fireEvent.pointerDown(map, { pointerId: 10, button: 0, clientX: 350, clientY: 250 });
    fireEvent.pointerMove(map, { pointerId: 10, button: 0, clientX: 370, clientY: 260 });
    fireEvent.pointerUp(map, { pointerId: 10, button: 0, clientX: 370, clientY: 260 });
    expect(transform.style.transform).not.toBe(beforePan);

    const beforePinch = transform.style.transform;
    fireEvent.pointerDown(map, { pointerId: 11, button: 0, clientX: 250, clientY: 240 });
    fireEvent.pointerDown(map, { pointerId: 12, button: 0, clientX: 350, clientY: 240 });
    fireEvent.pointerMove(map, { pointerId: 12, button: 0, clientX: 420, clientY: 240 });
    expect(transform.style.transform).not.toBe(beforePinch);
    fireEvent.pointerUp(map, { pointerId: 12, button: 0, clientX: 420, clientY: 240 });
    fireEvent.pointerUp(map, { pointerId: 11, button: 0, clientX: 250, clientY: 240 });
  });
});
