import { describe, expect, it } from "vitest";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";
import { CITY_CENTRE_AREA, toWorld } from "@/game/neighborhood-model";
import {
  checkNeighborhoodEntrances,
  neighborhoodRoadComponents,
} from "@/game/neighborhood-navigation";
import { zoneTagAtPoint } from "@/game/neighborhood-zones";

const origin = { x: 7, y: 6 };

describe("Olaiya neighborhood zone layout & walk-in collision", () => {
  it("defines all five zone tags with matching ground textures and specs", () => {
    const layout = CITY_CENTRE_AREA.zoneLayout;
    expect(layout).toBeDefined();
    if (!layout) return;

    const tags = new Set(layout.zones.map((zone) => zone.tag));
    expect(tags).toEqual(
      new Set(["FILLING_STATION", "BANK", "ADIRE_MARKET", "COMMERCIAL_SHOPS", "PERIMETER"]),
    );

    expect(zoneTagAtPoint(layout.zones, { x: 668, y: 250 })).toBe("FILLING_STATION");
    expect(zoneTagAtPoint(layout.zones, { x: 1135, y: 110 })).toBe("BANK");
    expect(zoneTagAtPoint(layout.zones, { x: 15, y: 100 })).toBe("ADIRE_MARKET");
    expect(zoneTagAtPoint(layout.zones, { x: 1515, y: 190 })).toBe("COMMERCIAL_SHOPS");
    expect(zoneTagAtPoint(layout.zones, { x: 880, y: -385 })).toBe("PERIMETER");
  });

  it("keeps all authored destinations and road networks reachable from spawn", () => {
    const roadComponents = neighborhoodRoadComponents(CITY_CENTRE_AREA, origin);
    expect(roadComponents).toHaveLength(1);

    const check = checkNeighborhoodEntrances(CITY_CENTRE_AREA, { x: 320, y: 300 }, origin);
    expect(check.spawnClear).toBe(true);
    expect(check.unreachable).toEqual([]);
  });

  it("allows walking from Left Avenue across the forecourt and inside the Fuel & Go Mini-Mart doorway", () => {
    const objects = CITY_CENTRE_AREA.objects;
    const obstacles = CITY_CENTRE_AREA.obstacles ?? [];

    // Forecourt apron & doorway corridor are walkable
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 562, y: 255 }, origin), origin, objects, obstacles),
    ).toBe(true);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 750, y: 255 }, origin), origin, objects, obstacles),
    ).toBe(true);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 800, y: 242 }, origin), origin, objects, obstacles),
    ).toBe(true);

    // Solid mini-mart walls, pump islands, and service alley water tank block movement
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 814, y: 136 }, origin), origin, objects, obstacles),
    ).toBe(false);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 863, y: 242 }, origin), origin, objects, obstacles),
    ).toBe(false);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 668, y: 192 }, origin), origin, objects, obstacles),
    ).toBe(false);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 830, y: 80 }, origin), origin, objects, obstacles),
    ).toBe(false);
  });

  it("keeps the Commercial Bank exterior ATM alcove, gated parking, and walk-in teller lobby open while blocking walls and counter", () => {
    const objects = CITY_CENTRE_AREA.objects;
    const obstacles = CITY_CENTRE_AREA.obstacles ?? [];

    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1136, y: 110 }, origin), origin, objects, obstacles),
    ).toBe(true);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1222, y: 332 }, origin), origin, objects, obstacles),
    ).toBe(true);
    // Open east lobby doorway & interior waiting floor are walkable
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1098, y: 16 }, origin), origin, objects, obstacles),
    ).toBe(true);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1020, y: 24 }, origin), origin, objects, obstacles),
    ).toBe(true);
    // Solid outer bank walls & teller counter block movement
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 942, y: 48 }, origin), origin, objects, obstacles),
    ).toBe(false);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 966, y: 40 }, origin), origin, objects, obstacles),
    ).toBe(false);
  });

  it("replaces edge slabs with varied instanced perimeter residences and grouped compound colliders", () => {
    const layout = CITY_CENTRE_AREA.zoneLayout!;
    expect(layout.perimeter.buildings.length).toBeGreaterThan(20);
    expect(new Set(layout.perimeter.buildings.map((b) => b.stories))).toEqual(new Set([1, 2]));
    expect(new Set(layout.perimeter.buildings.map((b) => b.rotationQuarterTurns))).toEqual(
      new Set([0, 1, 2, 3]),
    );
    expect(new Set(layout.perimeter.buildings.map((b) => b.roofVariant))).toEqual(
      new Set(["laterite", "silver"]),
    );
    expect(layout.perimeter.trees.some((t) => t.species === "oil-palm")).toBe(true);
    expect(layout.perimeter.trees.some((t) => t.species === "neem")).toBe(true);
    expect(layout.perimeter.poles.length).toBeGreaterThan(10);
  });
});
