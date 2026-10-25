import { expect, it } from "vitest";
import town from "@/data/osogbo-town.json";

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
  expect(town.landmarks).toHaveLength(22);
  expect(town.grid.rows).toHaveLength(18);
  expect(town.grid.rows.every((row) => row.length === 24)).toBe(true);
  for (const place of town.landmarks) {
    expect(town.districts.some((district) => district.id === place.districtId)).toBe(true);
    expect(town.grid.buildings.find((building) => building.placeId === place.id)).toMatchObject({
      x: place.grid.x,
      z: place.grid.z,
    });
  }
});
