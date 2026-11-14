import { expect, it } from "vitest";
import { playableDistrictForLocation, isPlayableDistrict } from "@/game/playable-district";
import { cityEntranceForRecord } from "@/lib/city-world";
import {
  neighborhoodAreaOrigin,
  neighborhoodSceneBounds,
  toScene,
  toWorld,
} from "@/game/neighborhood-model";
import {
  checkNeighborhoodEntrances,
  neighborhoodRoadComponents,
} from "@/game/neighborhood-navigation";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";

it("enables any stable slug with an active row and valid coordinates", () => {
  for (const slug of ["city-centre", "oja-oba", "student-district", "osogbo-central-mosque"]) {
    expect(isPlayableDistrict(slug)).toBe(true);
  }
  expect(
    playableDistrictForLocation({
      slug: "student-district",
      map_x: 1,
      map_y: 1,
      is_active: true,
    })?.area.slug,
  ).toBe("student-district");
  for (const slug of ["", "Bad Slug", "trailing-", "double--dash"]) {
    expect(isPlayableDistrict(slug)).toBe(false);
    expect(playableDistrictForLocation({ slug, map_x: 1, map_y: 1, is_active: true })).toBeNull();
  }
  expect(isPlayableDistrict(undefined)).toBe(false);
  expect(playableDistrictForLocation(undefined)).toBeNull();
  expect(
    playableDistrictForLocation({
      slug: "student-district",
      map_x: 1,
      map_y: 1,
      is_active: false,
    }),
  ).toBeNull();
  expect(
    playableDistrictForLocation({
      slug: "student-district",
      map_x: 101,
      map_y: 1,
      is_active: true,
    }),
  ).toBeNull();
});

it.each(["city-centre", "oja-oba"])("uses the same %s origin as the authoritative room", (slug) => {
  const location = { slug, map_x: 0, map_y: 0, is_active: true };
  const district = playableDistrictForLocation(location)!;
  expect(district.origin).toEqual(neighborhoodAreaOrigin(cityEntranceForRecord(location)));
  expect(toScene(district.origin, district.origin)).toEqual({ x: 320, y: 300 });
  const bounds = neighborhoodSceneBounds(district.origin);
  expect(toWorld({ x: bounds.left, y: bounds.top }, district.origin)).toEqual({ x: 0, y: 0 });
  expect(
    toWorld({ x: bounds.left + bounds.width, y: bounds.top + bounds.height }, district.origin),
  ).toEqual({ x: 24, y: 20 });
});

it("keeps the market distinct and preserves personal-home access only in Olaiya", () => {
  const market = playableDistrictForLocation({
    slug: "oja-oba",
    map_x: 0,
    map_y: 0,
    is_active: true,
  })!;
  const city = playableDistrictForLocation({
    slug: "city-centre",
    map_x: 0,
    map_y: 0,
    is_active: true,
  })!;
  expect(market.area.slug).toBe("oja-oba");
  expect(market.origin).not.toEqual(city.origin);
  expect(market.personalHome).toBe(false);
  expect(city.personalHome).toBe(true);
  expect(market.area.obstacles?.filter((o) => o.kind === "kiosk")).toHaveLength(3);
});

it("connects market roads and reaches every market entrance inside authoritative bounds", () => {
  const { area, origin } = playableDistrictForLocation({
    slug: "oja-oba",
    map_x: 0,
    map_y: 0,
    is_active: true,
  })!;
  expect(neighborhoodRoadComponents(area, origin)).toHaveLength(1);
  expect(checkNeighborhoodEntrances(area, { x: 320, y: 300 }, origin)).toMatchObject({
    spawnClear: true,
    unreachable: [],
  });
  const stall = area.obstacles!.find((o) => o.kind === "kiosk")!;
  expect(
    canOccupyNeighborhoodPoint(toWorld(stall, origin), origin, area.objects, area.obstacles),
  ).toBe(false);
});
