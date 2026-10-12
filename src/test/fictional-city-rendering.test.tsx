import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FictionalCityMap } from "@/components/game/FictionalCityMap";
import { OSOGBO_WORLD_NODES } from "@/lib/city-world";
import { NPC_CATALOG } from "@/lib/npc-simulation";
import type { Location } from "@/lib/game";
import { MAX_CITY_LOCATIONS, MAX_FICTIONAL_CITY_SVG_NODES } from "@/game/fictional-city-rendering";

const fixtures = vi.hoisted(() => ({
  queryData: {} as Record<string, unknown>,
  hour: 22,
  interactWithNpc: vi.fn(async () => ({
    accepted: true,
    message: "You greeted Adeola.",
    duplicate: false,
    event_id: "event-1",
  })),
}));
let frameCallback: FrameRequestCallback | null = null;

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => ({
    data: fixtures.queryData[String(options.queryKey[0])],
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"] }),
    locations: () => ({ queryKey: ["locations"] }),
    places: () => ({ queryKey: ["places"] }),
    wallet: () => ({ queryKey: ["wallet"] }),
    jobs: () => ({ queryKey: ["jobs"] }),
    npcs: () => ({ queryKey: ["npcs"] }),
  },
  rpc: { interactWithNpc: fixtures.interactWithNpc },
  formatNaira: (amount: number) => `₦${amount}`,
}));

vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: {
      gameTime: { day: 1, weekday: 0, hour: fixtures.hour, minute: 0 },
    },
  }),
}));

vi.mock("@/components/game/Avatar", () => ({ Avatar: () => null }));

function location(slug: string, index: number): Location {
  return {
    id: `location-${index}`,
    slug,
    name: slug,
    type: "civic",
    district_type: "civic",
    is_active: true,
    map_x: 50,
    map_y: 50,
    metadata: {},
  } as Location;
}

describe("fictional city rendering budget", () => {
  beforeEach(() => {
    fixtures.hour = 22;
    fixtures.interactWithNpc.mockClear();
    const knownLocations = Object.keys(OSOGBO_WORLD_NODES).map(location);
    const residentialLocation = location("residential", knownLocations.length);
    const extraLocations = Array.from({ length: 46 }, (_, index) =>
      location(`community-${index}`, knownLocations.length + index + 1),
    );
    fixtures.queryData = {
      character: null,
      locations: [...knownLocations, residentialLocation, ...extraLocations],
      places: Array.from({ length: 12 }, (_, index) => ({
        id: `place-${index}`,
        slug: `oja-oba-market-${index}`,
        name: `Market ${index}`,
        category: "market",
        description: "Market stalls",
        location_id: knownLocations[index % knownLocations.length]!.id,
        sort_order: index,
      })),
      wallet: null,
      jobs: [],
      npcs: NPC_CATALOG.map((npc) => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        personality: npc.personality,
        interests: npc.interests,
        topics: npc.topics,
      })),
    };
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    }
    class MutationObserverMock {
      constructor(_callback: MutationCallback) {}
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("MutationObserver", MutationObserverMock);
    frameCallback = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: () => ({ inverse: () => ({}) }),
    });
    Object.defineProperty(SVGSVGElement.prototype, "createSVGPoint", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      }),
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(SVGSVGElement.prototype, "getScreenCTM");
    Reflect.deleteProperty(SVGSVGElement.prototype, "createSVGPoint");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the full stable world visible under the SVG node cap", () => {
    const { container, rerender } = render(<FictionalCityMap />);
    act(() => frameCallback?.(0));
    const world = container.querySelector(".fictional-city");
    const map = container.querySelector("svg.city-world-svg");

    expect(world).toHaveAttribute("data-city-phase", "night");
    expect(world).toHaveAttribute("data-city-location-cap", String(MAX_CITY_LOCATIONS));
    expect(container.querySelectorAll(".city-building")).toHaveLength(MAX_CITY_LOCATIONS);
    expect(container.querySelectorAll(".city-place-marker")).toHaveLength(12);
    expect(container.querySelectorAll(".city-npc-marker")).toHaveLength(NPC_CATALOG.length);
    for (const slug of Object.keys(OSOGBO_WORLD_NODES)) {
      expect(container.querySelector(`[aria-label="Select ${slug}"]`)).not.toBeNull();
    }
    expect(container.textContent).toContain("Showing 60 of 62 places");
    expect(map).toHaveAttribute("data-svg-node-cap", String(MAX_FICTIONAL_CITY_SVG_NODES));
    expect(container.querySelectorAll("svg *").length).toBeLessThanOrEqual(
      MAX_FICTIONAL_CITY_SVG_NODES,
    );
    expect(map?.querySelector(".city-time-overlay--night")).not.toBeNull();
    expect(map?.querySelectorAll(".city-road-network path")).toHaveLength(4);
    expect(map?.querySelectorAll(".city-tree")).toHaveLength(24);

    fixtures.hour = 12;
    rerender(<FictionalCityMap />);
    expect(container.querySelector(".fictional-city")).toHaveAttribute("data-city-phase", "day");
    fixtures.hour = 5;
    rerender(<FictionalCityMap />);
    expect(container.querySelector(".fictional-city")).toHaveAttribute(
      "data-city-phase",
      "sunrise",
    );
    fixtures.hour = 17;
    rerender(<FictionalCityMap />);
    expect(container.querySelector(".fictional-city")).toHaveAttribute("data-city-phase", "sunset");
    fixtures.hour = 18;
    rerender(<FictionalCityMap />);
    expect(container.querySelector(".fictional-city")).toHaveAttribute("data-city-phase", "night");
  });

  it("opens seeded bank and market services from map markers", () => {
    const knownLocations = Object.keys(OSOGBO_WORLD_NODES).map(location);
    const ojaOba = knownLocations.find((item) => item.slug === "oja-oba")!;
    fixtures.queryData = {
      character: null,
      locations: knownLocations,
      places: [
        {
          id: "bank-place",
          slug: "city-centre-bank",
          name: "Osun Unity Bank",
          category: "bank",
          description: "Bank services",
          location_id: ojaOba.id,
          sort_order: 1,
        },
        {
          id: "market-place",
          slug: "oja-oba-market",
          name: "Oja Oba Market",
          category: "market",
          description: "Market stalls",
          location_id: ojaOba.id,
          sort_order: 2,
        },
      ],
      wallet: null,
      jobs: [],
      npcs: [],
    };
    const { container } = render(<FictionalCityMap />);

    expect(
      container.querySelector('[aria-label="Open Osun Unity Bank in oja-oba"]'),
    ).not.toBeNull();
    expect(container.querySelector('[aria-label="Open Oja Oba Market in oja-oba"]')).not.toBeNull();
    expect(container.querySelectorAll(".city-place-marker")).toHaveLength(2);
    expect(container.querySelectorAll("svg *").length).toBeLessThanOrEqual(
      MAX_FICTIONAL_CITY_SVG_NODES,
    );
  });

  it("shows scheduled NPCs on the map and sends greetings through the server RPC", async () => {
    fixtures.hour = 12;
    const knownLocations = Object.keys(OSOGBO_WORLD_NODES).map(location);
    const ojaOba = knownLocations.find((item) => item.slug === "oja-oba")!;
    fixtures.queryData = {
      character: {
        name: "Player",
        current_location_id: ojaOba.id,
        world_x: 4,
        world_y: 5,
        world_position_revision: 0,
      },
      locations: knownLocations,
      places: [],
      wallet: null,
      jobs: [],
      npcs: [
        {
          id: "npc-adeola",
          name: "Adeola Akinyemi",
          role: "Market trader",
          personality: "warm",
          interests: ["cooking"],
          topics: ["market stories"],
        },
      ],
    };
    const { container, findByRole, getByRole } = render(<FictionalCityMap />);

    expect(container.querySelectorAll(".city-npc-marker")).toHaveLength(1);
    expect(getByRole("complementary", { name: "Neighbour greetings" })).toHaveTextContent(
      "Adeola waves hello",
    );
    const marker = container.querySelector('[aria-label^="Adeola Akinyemi"]');
    expect(marker).not.toBeNull();
    await act(async () => {
      getByRole("button", { name: /adeola waves hello/i }).click();
    });
    expect(await findByRole("dialog")).toHaveTextContent("notices you and waves hello");
    await act(async () => {
      getByRole("button", { name: /respond with a greeting/i }).click();
    });
    expect(fixtures.interactWithNpc).toHaveBeenCalledWith(
      expect.objectContaining({ npcId: "npc-adeola", action: "greet" }),
    );
  });
});
