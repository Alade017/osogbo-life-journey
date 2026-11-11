import { expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import { validateTownMapData } from "@/game/town-map-validation";

type AuthoredPlace = {
  id: string;
  districtId: string;
  locationSlug: string | null;
  grid: { x: number; z: number };
  buildingType?: string;
  mapObjectType?: string;
};

const places = town.landmarks as readonly AuthoredPlace[];

it("keeps every authored district, landmark and building identity unique", () => {
  for (const ids of [
    town.districts.map((district) => district.id),
    places.map((place) => place.id),
    town.grid.buildings.map((building) => building.placeId),
  ]) {
    expect(new Set(ids).size).toBe(ids.length);
  }
});

it("derives map dimensions and counts from authored data", () => {
  expect(town.grid.rows).toHaveLength(town.meta.grid.rows);
  expect(town.grid.rows.every((row) => row.length === town.meta.grid.columns)).toBe(true);
  expect(town.grid.buildings.length).toBeLessThanOrEqual(town.landmarks.length);
  expect(town.districts.length).toBeGreaterThan(0);
  expect(town.landmarks.length).toBeGreaterThan(0);
});

it("links every landmark to a stable destination or explicitly marks it map-only", () => {
  for (const place of places) {
    expect(town.districts.some((district) => district.id === place.districtId)).toBe(true);
    expect(Object.hasOwn(MAP_LANDMARK_LOCATION_SLUG, place.id)).toBe(true);
    expect(MAP_LANDMARK_LOCATION_SLUG[place.id]).toBe(place.locationSlug);
    const building = town.grid.buildings.find((item) => item.placeId === place.id);
    if (place.buildingType) {
      expect(building).toMatchObject({ x: place.grid.x, z: place.grid.z });
    } else {
      expect(building).toBeUndefined();
      expect(place.mapObjectType).toBeTruthy();
    }
  }
});

it("keeps the authored road network connected", () => {
  const roads = new Set<string>();
  town.grid.rows.forEach((row, z) => {
    [...row].forEach((tile, x) => {
      if (tile === "r") roads.add(`${x},${z}`);
    });
  });

  const firstRoad = roads.values().next().value as string | undefined;
  expect(firstRoad).toBeDefined();
  const visited = new Set<string>([firstRoad!]);
  const queue = [firstRoad!];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]!;
    const [x = 0, z = 0] = current.split(",").map(Number);
    for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const neighbor = `${x + dx},${z + dz}`;
      if (!roads.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  expect(visited.size).toBe(roads.size);
});

it("keeps every district grid area inside the authored map bounds", () => {
  for (const district of town.districts) {
    const { x, z, width, depth } = district.gridArea;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(z).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(town.meta.grid.columns);
    expect(z + depth).toBeLessThanOrEqual(town.meta.grid.rows);
  }
});

it("passes the full map data validator", () => {
  expect(validateTownMapData(town)).toEqual([]);
});
