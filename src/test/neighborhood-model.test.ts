import { describe, expect, it } from "vitest";
import townData from "@/data/osogbo-town.json";
import { OSOGBO_WORLD_NODES, cityEntranceForLocation } from "@/lib/city-world";
import {
  neighborhoodAreaForSlug,
  neighborhoodAreaOrigin,
  neighborhoodOrigin,
  nearestInteraction,
  toScene,
  toWorld,
  validCheckpoint,
} from "@/game/neighborhood-model";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";
import { isPlayableDistrict, isPlayableLocationRecord } from "@/game/playable-district";
import {
  checkNeighborhoodEntrances,
  neighborhoodRoadComponents,
} from "@/game/neighborhood-navigation";
const townDataLandmarkIdsForTest = () =>
  Object.groupBy(townData.landmarks, (landmark) => landmark.locationSlug) as Record<string, string[]>;

describe("neighborhood coordinates and interaction", () => {
  it("selects distinct shared street layouts for Olaiya and Oja-Oba", () => {
    const olaiya = neighborhoodAreaForSlug("city-centre");
    const market = neighborhoodAreaForSlug("oja-oba");
    expect(olaiya.objects.find((object) => object.id === "market")?.x).not.toBe(
      market.objects.find((object) => object.id === "market")?.x,
    );
    expect(market.marketStalls).toHaveLength(3);
    expect(neighborhoodAreaForSlug("unmapped-district")).toBe(olaiya);
  });
  it("defines connected Olaiya roads and collision obstacles for the playable scene", () => {
    const area = neighborhoodAreaForSlug("city-centre");
    expect(area.roads?.filter((road) => road.type === "arterial")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ axis: "vertical", offset: 500 }),
        expect.objectContaining({ axis: "horizontal", offset: 500 }),
      ]),
    );
    expect(area.roads?.find((road) => road.id === "home-access-lane")).toMatchObject({
      axis: "horizontal",
      start: 320,
      end: 500,
    });
    expect(area.paths?.[0]).toMatchObject({
      id: "home-to-street-path",
      from: { x: 320, y: 300 },
      to: { x: 320, y: 340 },
    });
    expect(area.roads?.some((road) => road.id === "west-residential-street")).toBe(true);
    expect(area.obstacles?.some((obstacle) => obstacle.kind === "compound")).toBe(true);
    expect(area.obstacles?.some((obstacle) => obstacle.kind === "streetlight")).toBe(true);
    expect(area.obstacles?.some((obstacle) => obstacle.kind === "bench")).toBe(true);
  });
  it("provides a deterministic playable template for every registered city district", () => {
    for (const node of Object.values(OSOGBO_WORLD_NODES)) {
      const area = neighborhoodAreaForSlug(node.slug);
      expect(area.slug).toBe(node.slug);
      const displayNameOverrides: Record<string, string> = {
        "city-centre": "Olaiya",
        "oja-oba": "Oja-Oba Market",
      };
      expect(area.name).toBe(displayNameOverrides[node.slug] ?? node.name);
      expect(area.objects.slice(0, 3).map((object) => object.id)).toEqual([
        "home",
        "market",
        "work",
      ]);
      expect(new Set(area.objects.map((object) => `${object.x}:${object.y}`)).size).toBe(
        area.objects.length,
      );
      if (node.slug !== "city-centre" && node.slug !== "oja-oba") {
        expect(area.objects.filter((object) => object.kind === "npc")).toHaveLength(3);
        expect(area.roads).toHaveLength(6);
        expect(area.paths).toHaveLength(2);
        expect(area.obstacles?.map((obstacle) => obstacle.kind)).toEqual(
          expect.arrayContaining([
            "compound",
            expect.stringMatching(/shop|kiosk/),
            "landmark",
            "tree",
            "bench",
            "streetlight",
          ]),
        );
      }
    }
    expect(neighborhoodAreaForSlug("residential").name).toBe("Residential District");
    expect(neighborhoodAreaForSlug("business-district").name).toBe("Business District");
  });
  it("admits any stable slug with an active row and valid coordinates", () => {
    for (const slug of ["residential", "osogbo-central-mosque", "student-district"]) {
      expect(isPlayableDistrict(slug)).toBe(true);
    }
    for (const slug of ["", "bad slug", "Unknown", "-leading", "double--dash", undefined]) {
      expect(isPlayableDistrict(slug)).toBe(false);
    }
    expect(
      isPlayableLocationRecord({
        id: "destination-id",
        slug: "student-district",
        map_x: 50,
        map_y: 25,
        is_active: true,
      }),
    ).toBe(true);
    expect(
      isPlayableLocationRecord({
        id: "destination-id",
        slug: "student-district",
        map_x: 50,
        map_y: 25,
        is_active: false,
      }),
    ).toBe(false);
  });
  it("generates stable, materially different roads, storefronts, pedestrians, landmarks and collisions", () => {
    const campus = neighborhoodAreaForSlug("student-district");
    const foodCourt = neighborhoodAreaForSlug("riverside-food-court");
    expect(neighborhoodAreaForSlug("student-district")).toEqual(campus);
    expect(campus.roads).not.toEqual(foodCourt.roads);
    expect(campus.objects.filter((object) => object.kind === "npc")).not.toEqual(
      foodCourt.objects.filter((object) => object.kind === "npc"),
    );
    expect(campus.obstacles).not.toEqual(foodCourt.obstacles);
    expect(
      canOccupyNeighborhoodPoint({ x: 5, y: 9 }, { x: 5, y: 9 }, campus.objects, campus.obstacles),
    ).toBe(true);
  });
  it("keeps every generated playable entrance clear and the road network connected", () => {
    for (const slug of Object.keys(OSOGBO_WORLD_NODES).filter(isPlayableDistrict)) {
      if (slug === "city-centre" || slug === "oja-oba") continue;
      const area = neighborhoodAreaForSlug(slug);
      const origin = neighborhoodAreaOrigin(cityEntranceForLocation(slug));
      const report = checkNeighborhoodEntrances(area, { x: 320, y: 300 }, origin);
      expect(report.spawnClear, `${slug} should have a navigable entrance spawn`).toBe(true);
      expect(report.unreachable, `${slug} should keep its destinations reachable`).toEqual([]);
      expect(neighborhoodRoadComponents(area, origin), `${slug} roads should connect`).toHaveLength(
        1,
      );
    }
  }, 20_000);
  it("keeps distant legacy checkpoints visible without replacing their coordinates", () => {
    const point = { x: 3, y: 8 };
    const scene = toScene(point, neighborhoodOrigin({ x: 7, y: 6 }, point));
    expect(scene.x).toBeGreaterThan(12);
    expect(scene.x).toBeLessThan(628);
    expect(scene.y).toBeGreaterThan(12);
    expect(scene.y).toBeLessThan(548);
  });
  it("round-trips persisted coordinates independently of camera scale", () => {
    const origin = { x: 7, y: 6 };
    const checkpoint = { x: 7.625, y: 5.75 };
    expect(toWorld(toScene(checkpoint, origin), origin)).toEqual(checkpoint);
  });
  it("registers exactly one authoritative interaction point for every town landmark", () => {
    const town = neighborhoodAreaForSlug("city-centre");
    const anchors = townDataLandmarkIdsForTest();
    for (const [slug, ids] of Object.entries(anchors)) {
      const area = neighborhoodAreaForSlug(slug);
      expect(area.interactionPoints?.map((point) => point.id).sort(), slug).toEqual([...ids].sort());
      expect(new Set(area.interactionPoints?.map((point) => point.id)).size).toBe(ids.length);
      for (const point of area.interactionPoints ?? []) {
        expect(point.radius).toBeGreaterThan(0);
        expect(point.x).toBeGreaterThanOrEqual(48);
        expect(point.x).toBeLessThanOrEqual(592);
      }
    }
    expect(town.interactionPoints ?? []).toEqual([]);
  });
  it("resolves Oja-Oba only through its explicit landmark anchor", () => {
    const area = neighborhoodAreaForSlug("oja-oba");
    expect(area.interactionPoints).toEqual([
      { id: "oja-oba-market", x: 145, y: 220, radius: 60 },
    ]);
  });
  it("only offers interaction within reach and picks the closest target", () => {
    const area = neighborhoodAreaForSlug("city-centre");
    expect(nearestInteraction({ x: 320, y: 300 }, area.objects)?.kind).toBe("home");
    expect(
      canOccupyNeighborhoodPoint({ x: 7, y: 6 }, { x: 7, y: 6 }, area.objects, area.obstacles),
    ).toBe(true);
    expect(
      canOccupyNeighborhoodPoint(
        toWorld({ x: 320, y: 260 }, { x: 7, y: 6 }),
        { x: 7, y: 6 },
        area.objects,
        area.obstacles,
      ),
    ).toBe(false);
    expect(nearestInteraction({ x: 190, y: 420 })?.kind).toBe("npc");
  });
  it("rejects corrupt and out-of-city checkpoints", () => {
    expect(validCheckpoint({ x: 7, y: 6 })).toBe(true);
    for (const x of [NaN, Infinity, -1, 15]) expect(validCheckpoint({ x, y: 6 })).toBe(false);
    expect(validCheckpoint({ x: 7, y: 13 })).toBe(false);
  });
});
