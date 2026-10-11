import { describe, expect, it } from "vitest";
import { OSOGBO_WORLD_NODES } from "@/lib/city-world";
import {
  neighborhoodAreaForSlug,
  neighborhoodOrigin,
  nearestInteraction,
  toScene,
  toWorld,
  validCheckpoint,
} from "@/game/neighborhood-model";
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
  it("provides a deterministic playable template for every registered city district", () => {
    for (const node of Object.values(OSOGBO_WORLD_NODES)) {
      const area = neighborhoodAreaForSlug(node.slug);
      expect(area.slug).toBe(node.slug);
      expect(area.name).toBe(node.name);
      expect(area.objects.map((object) => object.id)).toEqual(["home", "market", "work", "npc"]);
      expect(new Set(area.objects.map((object) => `${object.x}:${object.y}`)).size).toBe(4);
    }
    expect(neighborhoodAreaForSlug("residential").name).toBe("Residential District");
    expect(neighborhoodAreaForSlug("business-district").name).toBe("Business District");
  });
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
    expect(nearestInteraction({ x: 320, y: 300 })).toBeNull();
    expect(nearestInteraction({ x: 190, y: 420 })?.kind).toBe("npc");
    expect(nearestInteraction({ x: 170, y: 220 })?.kind).toBe("home");
  });
  it("rejects corrupt and out-of-city checkpoints", () => {
    expect(validCheckpoint({ x: 7, y: 6 })).toBe(true);
    for (const x of [NaN, Infinity, -1, 15]) expect(validCheckpoint({ x, y: 6 })).toBe(false);
    expect(validCheckpoint({ x: 7, y: 13 })).toBe(false);
  });
});
