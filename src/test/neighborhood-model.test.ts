import { describe, expect, it } from "vitest";
import { OSOGBO_WORLD_NODES, cityEntranceForLocation } from "@/lib/city-world";
import { townAnchorForSlug } from "@/game/town-neighborhood";
import {
  neighborhoodAreaForSlug,
  neighborhoodAreaOrigin,
  neighborhoodOrigin,
  nearestInteraction,
  neighborhoodSceneBounds,
  WORLD_SCALE,
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
describe("neighborhood coordinates and interaction", () => {
  it("selects distinct shared street layouts for Olaiya and Oja-Oba", () => {
    const olaiya = neighborhoodAreaForSlug("city-centre");
    const market = neighborhoodAreaForSlug("oja-oba");
    expect(olaiya.objects.find((object) => object.id === "market")?.x).not.toBe(
      market.objects.find((object) => object.id === "market")?.x,
    );
    expect(market.marketStalls).toHaveLength(3);
    expect(market.objects.find((object) => object.id === "market")?.shopSlug).toBe(
      "market-sales-stall",
    );
    for (const id of ["oja-oba-produce-stall", "oja-oba-grain-stall", "oja-oba-household-stall"]) {
      expect(market.objects.find((object) => object.id === id)?.shopSlug).toBeNull();
    }
    expect(neighborhoodAreaForSlug("unmapped-district")).toBe(olaiya);
  });
  it("builds Olaiya's roads and spot landmarks from the town data", () => {
    const area = neighborhoodAreaForSlug("city-centre");
    expect(area.name).toBe("Olaiya");
    expect(area.roads?.length ?? 0).toBeGreaterThan(0);
    const labels = (area.obstacles ?? []).map((obstacle) => obstacle.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Fuel & Go Forecourt Pumps", "Meridian Bank ATM Alcove"]),
    );
    expect(area.zoneLayout).toBeUndefined();
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
      // Places with a landmark in the town data are walked from that data (see town-neighborhood).
      const handBuilt = ["city-centre", "oja-oba", "fuel-and-go"];
      if (townAnchorForSlug(node.slug) && !handBuilt.includes(node.slug)) {
        expect(area.objects.filter((object) => object.kind === "npc").length).toBeGreaterThan(0);
        const kinds = area.obstacles?.map((obstacle) => obstacle.kind) ?? [];
        expect(kinds.some((kind) => kind === "shop" || kind === "landmark")).toBe(true);
      } else if (!handBuilt.includes(node.slug)) {
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
  it("only offers interaction within reach and picks the closest target", () => {
    const area = neighborhoodAreaForSlug("city-centre");
    const home = area.objects.find((object) => object.id === "home")!;
    expect(nearestInteraction({ x: home.x, y: home.y }, area.objects)?.kind).toBe("home");
    expect(
      canOccupyNeighborhoodPoint({ x: 7, y: 6 }, { x: 7, y: 6 }, area.objects, area.obstacles),
    ).toBe(true);
    const npc = area.objects.find((object) => object.kind === "npc")!;
    expect(nearestInteraction({ x: npc.x, y: npc.y })?.kind).toBe("npc");
  });
  it("rejects corrupt and out-of-city checkpoints", () => {
    expect(validCheckpoint({ x: 7, y: 6 })).toBe(true);
    for (const x of [NaN, Infinity, -1, 25]) expect(validCheckpoint({ x, y: 6 })).toBe(false);
    expect(validCheckpoint({ x: 7, y: 21 })).toBe(false);
    expect(validCheckpoint({ x: 24, y: 20 })).toBe(true);
    expect(neighborhoodSceneBounds({ x: 7, y: 6 })).toMatchObject({
      width: 24 * WORLD_SCALE,
      height: 20 * WORLD_SCALE,
    });
  });
});
