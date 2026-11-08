import { expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";

it("gives every district, landmark and building one identity in the expanded town", () => {
  for (const ids of [
    town.districts.map((district) => district.id),
    town.landmarks.map((place) => place.id),
    town.grid.buildings.map((building) => building.placeId),
  ]) {
    expect(new Set(ids).size).toBe(ids.length);
  }
  expect(town.meta.grid).toEqual({ columns: 24, rows: 18, cellSize: 2 });
  expect(town.districts).toHaveLength(11);
  expect(town.landmarks).toHaveLength(26);
  expect(town.grid.rows).toHaveLength(18);
  expect(town.grid.rows.every((row) => row.length === 24)).toBe(true);
  expect(new Set(town.grid.buildings.map(({ x, z }) => `${x},${z}`)).size).toBe(
    town.grid.buildings.length,
  );
  for (const place of town.landmarks) {
    expect(town.districts.some((district) => district.id === place.districtId)).toBe(true);
    expect(MAP_LANDMARK_LOCATION_SLUG[place.id]).toBe(place.locationSlug);
    expect(town.grid.buildings.find((building) => building.placeId === place.id)).toMatchObject({
      x: place.grid.x,
      z: place.grid.z,
    });
  }
});


it("keeps every road tile connected to the town road network", () => {
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

  while (queue.length) {
    const current = queue.shift()!;
    const [x, z] = current.split(",").map(Number);
    for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const neighbor = `${x + dx},${z + dz}`;
      if (!roads.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  expect(visited.size).toBe(roads.size);
});

it("keeps district grid bounds inside the authored town grid", () => {
  for (const district of town.districts) {
    const { x, z, width, depth } = district.gridArea;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(z).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(town.grid.rows[0]!.length);
    expect(z + depth).toBeLessThanOrEqual(town.grid.rows.length);
  }
});
