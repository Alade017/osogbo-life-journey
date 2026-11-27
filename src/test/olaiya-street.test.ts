// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYOUT_AREAS, layoutJson } from "../../scripts/blender/export-layouts";
import { CITY_CENTRE_AREA, OLAIYA_SPOTS } from "../game/neighborhood-model";
import { NEIGHBORHOOD_LANDMARKS } from "../data/neighborhoodLocations";
import { findInteractableZone } from "../game/neighborhood-interactions";

type TownLandmark = { id: string; districtId: string };
const town = JSON.parse(readFileSync(join("src/data/osogbo-town.json"), "utf8")) as {
  landmarks: TownLandmark[];
};
const townOlaiyaIds = town.landmarks
  .filter((landmark) => landmark.districtId === "olaiya")
  .map((landmark) => landmark.id)
  .sort();
const spotIds = Object.keys(OLAIYA_SPOTS).sort();

const ROAD_TOLERANCE = 1;

function spotFor(id: string) {
  const spot = OLAIYA_SPOTS[id];
  if (!spot) throw new Error(`no Olaiya spot for ${id}`);
  return spot;
}

// A point is on a road when it lies within the road's width of its centre line.
function onRoad(point: { x: number; y: number }) {
  return (CITY_CENTRE_AREA.roads ?? []).some((road) => {
    const across = road.axis === "vertical" ? point.x : point.y;
    return Math.abs(across - road.offset) <= road.width / 2 + ROAD_TOLERANCE;
  });
}

function insideObstacle(point: { x: number; y: number }) {
  return (CITY_CENTRE_AREA.obstacles ?? [])
    .filter((o) => o.kind !== "tree")
    .some((o) => Math.abs(point.x - o.x) < o.width / 2 && Math.abs(point.y - o.y) < o.height / 2);
}

describe("Olaiya street", () => {
  it("places every town landmark in Olaiya on the street", () => {
    expect(spotIds).toEqual(townOlaiyaIds);
  });

  it.each(spotIds.map((id) => [id] as const))("%s is reached from a road", (id) => {
    expect(onRoad(spotFor(id).accessPoint)).toBe(true);
  });

  it.each(spotIds.map((id) => [id] as const))("%s access point is not inside a building", (id) => {
    expect(insideObstacle(spotFor(id).accessPoint)).toBe(false);
  });

  it("exports every place to the Blender layout", () => {
    const json = layoutJson(CITY_CENTRE_AREA);
    const exported = json.places.map((place) => place.id).sort();
    expect(exported).toEqual(spotIds);
    expect(json.frame).toEqual({ width_m: 60, depth_m: 45 });
  });

  it("is one of the exported layouts", () => {
    expect(LAYOUT_AREAS.map((area) => area.slug)).toContain(CITY_CENTRE_AREA.slug);
    const committed = readFileSync(join("scripts/blender/layouts/city-centre.json"), "utf8");
    expect(committed).toBe(`${JSON.stringify(layoutJson(CITY_CENTRE_AREA), null, 2)}\n`);
  });

  it.each(NEIGHBORHOOD_LANDMARKS.map((landmark) => [landmark.id, landmark] as const))(
    "%s map point is its street place",
    (_id, landmark) => {
      const zone = findInteractableZone(landmark.primaryZoneId);
      expect(zone).not.toBeNull();
      expect(landmark.scenePoint).toEqual(zone?.position);
    },
  );
});
