import { describe, expect, it } from "vitest";
import { isPlayableLocationRecord, playableDistrictForLocation } from "@/game/playable-district";
import {
  neighborhoodAreaForLocation,
  nearbyInteractionPoint,
  toWorld,
} from "@/game/neighborhood-model";

const base = { map_x: 40, map_y: 55, is_active: true as const };

describe("every active location has a playable area", () => {
  it("builds a deterministic area for a place that is not in the blueprint registry", () => {
    const place = { ...base, slug: "fish-market", name: "Fish Market", map_category: "commercial" };
    const first = playableDistrictForLocation(place);
    const second = playableDistrictForLocation(place);
    expect(first).not.toBeNull();
    expect(first!.area.objects.length).toBeGreaterThan(0);
    expect(first!.area).toEqual(second!.area);
    expect(first!.origin.x).toBeTypeOf("number");
  });

  it("uses the database name and category so the layout reflects the place", () => {
    const market = neighborhoodAreaForLocation({
      slug: "fish-market",
      name: "Fish Market",
      map_category: "commercial",
    });
    const park = neighborhoodAreaForLocation({
      slug: "neighbourhood-park-test",
      name: "Park",
      map_category: "recreation",
    });
    expect(market.name).toContain("Fish Market");
    expect(park.name).toContain("Park");
  });

  it("registers a stable scene-space interaction point for generated landmarks", () => {
    const place = { ...base, slug: "cedar-bank", name: "Cedar Bank", map_category: "commercial" };
    const area = neighborhoodAreaForLocation(place);
    const target = area.interactionPoints?.find((point) => point.id === place.slug);
    expect(target).toBeDefined();
    expect(target).toMatchObject({ x: area.objects.find((object) => object.kind === "market")!.x,
      y: area.objects.find((object) => object.kind === "market")!.y, radius: 65 });
  });

  it("resolves proximity using the authoritative world position, not a client target position", () => {
    const area = neighborhoodAreaForLocation({
      slug: "cedar-bank",
      name: "Cedar Bank",
      map_category: "commercial",
    });
    const target = area.interactionPoints![0]!;
    const origin = { x: 7, y: 6 };
    const playerAtTarget = toWorld({ x: target.x, y: target.y }, origin);
    expect(nearbyInteractionPoint(playerAtTarget, origin, area)?.id).toBe("cedar-bank");
    expect(nearbyInteractionPoint({ x: 0, y: 0 }, origin, area)).toBeNull();
  });

  it("still refuses rows that are inactive, unstable or without valid coordinates", () => {
    expect(
      playableDistrictForLocation({ ...base, slug: "fish-market", is_active: false }),
    ).toBeNull();
    expect(playableDistrictForLocation({ ...base, slug: "Fish Market" })).toBeNull();
    expect(playableDistrictForLocation({ ...base, slug: "fish-market", map_x: 140 })).toBeNull();
    expect(isPlayableLocationRecord({ id: "1", slug: "fish-market", ...base })).toBe(true);
    expect(isPlayableLocationRecord({ id: "1", slug: "fish-market", ...base, map_y: -1 })).toBe(
      false,
    );
  });
});
