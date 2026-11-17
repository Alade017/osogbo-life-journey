import { describe, expect, it } from "vitest";
import townData from "@/data/osogbo-town.json";
import { neighborhoodAreaForLocation } from "@/game/neighborhood-model";
import { townAnchorForSlug, townNeighborhoodArea } from "@/game/town-neighborhood";

const SPAWN = { x: 320, y: 300 };

function distanceFromSpawn(point: { x: number; y: number }) {
  return Math.hypot(point.x - SPAWN.x, point.y - SPAWN.y);
}

describe("town-driven neighbourhoods", () => {
  it("builds the walk for a town place from its grid window", () => {
    const area = neighborhoodAreaForLocation({ slug: "town-market", name: "Town market" });
    expect(area.name).toBe("Town market");
    expect(area.roads?.length ?? 0).toBeGreaterThan(0);
    const compounds = area.obstacles?.filter((obstacle) => obstacle.kind === "compound") ?? [];
    expect(compounds.length).toBeGreaterThan(0);
    const kinds = new Set(area.objects.map((object) => object.kind));
    expect(kinds).toEqual(new Set(["home", "market", "npc", "work"]));
  });

  it("keeps the spawn point clear of obstacles", () => {
    const anchor = townAnchorForSlug("town-market");
    expect(anchor).not.toBeNull();
    const area = townNeighborhoodArea(anchor!);
    for (const obstacle of area.obstacles ?? []) {
      expect(distanceFromSpawn(obstacle)).toBeGreaterThan(40);
    }
  });

  it("gives every town place with a grid cell its own walkable area", () => {
    const places = townData.landmarks.filter(
      (landmark) => landmark.locationSlug && "grid" in landmark && landmark.grid,
    );
    expect(places.length).toBeGreaterThan(20);
    for (const place of places) {
      const area = neighborhoodAreaForLocation({ slug: place.locationSlug!, name: place.label });
      expect(area.objects.length).toBeGreaterThan(0);
      expect(area.style.ground).toBeGreaterThan(0);
    }
  });

  it("walks Olaiya from the town data, with its spots as landmarks", () => {
    const olaiya = neighborhoodAreaForLocation({ slug: "city-centre", name: "City centre" });
    expect(olaiya.zoneLayout).toBeUndefined();
    const labels = (olaiya.obstacles ?? []).map((obstacle) => obstacle.label);
    expect(labels).toContain("Meridian Bank ATM Alcove");
  });

  it("places roads on the grid so each road is a run of road cells", () => {
    const anchor = townAnchorForSlug("town-market")!;
    const area = townNeighborhoodArea(anchor);
    for (const road of area.roads ?? []) {
      expect(road.width).toBeGreaterThan(0);
      expect(road.end ?? 0).toBeGreaterThan(road.start ?? 0);
    }
  });
});
