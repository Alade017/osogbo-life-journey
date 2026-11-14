import { expect, it } from "vitest";
import {
  neighborhoodBuildingFootprint,
  projectNeighborhood,
  unprojectNeighborhood,
  neighborhoodDepth,
} from "@/game/neighborhood-geometry";
import {
  checkNeighborhoodEntrances,
  neighborhoodRoadComponents,
} from "@/game/neighborhood-navigation";
import { neighborhoodAreaForSlug, toWorld } from "@/game/neighborhood-model";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";

it("round-trips projection across the entire playable bounds without changing persistence", () => {
  for (const p of [
    { x: -800, y: -660 },
    { x: 1440, y: 1260 },
    { x: 320, y: 300 },
  ]) {
    const screen = projectNeighborhood(p.x, p.y);
    const result = unprojectNeighborhood(screen.x, screen.y);
    expect(result.x).toBeCloseTo(p.x);
    expect(result.y).toBeCloseTo(p.y);
  }
  expect(neighborhoodDepth(320, 301)).toBeGreaterThan(neighborhoodDepth(320, 300));
});

it("uses the same building ground rectangle for rendering and authoritative collision", () => {
  const area = neighborhoodAreaForSlug("city-centre");
  for (const object of area.objects.filter((o) => o.kind !== "npc" && !o.walkIn && o.collision !== false)) {
    const r = neighborhoodBuildingFootprint(object);
    expect(r).toEqual({ left: object.x - 57, top: object.y - 62, width: 114, height: 58 });
    expect(
      canOccupyNeighborhoodPoint(
        toWorld({ x: object.x, y: r.top + 20 }, { x: 7, y: 6 }),
        { x: 7, y: 6 },
        area.objects,
        area.obstacles,
      ),
    ).toBe(false);
  }
});

it("reaches every authored Olaiya entrance from the saved entrance without crossing solids", () => {
  const report = checkNeighborhoodEntrances(
    neighborhoodAreaForSlug("city-centre"),
    { x: 320, y: 300 },
    { x: 7, y: 6 },
  );
  expect(report.spawnClear).toBe(true);
  expect(report.unreachable).toEqual([]);
  expect(report.visited).toBeGreaterThan(1000);
}, 20_000);

it("rejects a blocked spawn and a sealed entrance in authored data", () => {
  const area = neighborhoodAreaForSlug("city-centre");
  const market = area.objects.find((o) => o.kind === "market")!;
  const obstructed = {
    ...area,
    obstacles: [
      ...(area.obstacles ?? []),
      {
        id: "closed-approach",
        kind: "compound" as const,
        x: market.x,
        y: market.y,
        width: 220,
        height: 220,
      },
    ],
  };
  expect(
    checkNeighborhoodEntrances(obstructed, { x: 320, y: 300 }, { x: 7, y: 6 }).unreachable,
  ).toContain(market.id);
  expect(checkNeighborhoodEntrances(obstructed, market, { x: 7, y: 6 }).spawnClear).toBe(false);
}, 20_000);

it("connects every Olaiya road including the home lane and detects isolated segments", () => {
  const area = neighborhoodAreaForSlug("city-centre");
  const connected = neighborhoodRoadComponents(area);
  expect(connected).toHaveLength(1);
  expect(connected[0]).toHaveLength(area.roads!.length);
  const isolated = {
    id: "isolated-lane",
    axis: "horizontal" as const,
    offset: -600,
    width: 10,
    type: "lane" as const,
    start: -780,
    end: -760,
  };
  expect(neighborhoodRoadComponents({ ...area, roads: [...area.roads!, isolated] })).toHaveLength(
    2,
  );
});
