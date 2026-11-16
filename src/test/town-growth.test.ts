import { expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { validateTownMapData } from "@/game/town-map-validation";
import { addDistrictToTown, type TownGridData } from "@/game/town-growth";

const base = town as unknown as TownGridData;

it("places a new district in free grass without growing the map when there is room", () => {
  const grown = addDistrictToTown(base, {
    id: "test-quarter",
    name: "Test quarter",
    theme: "residential",
    traffic: "low",
    description: "A fictional test quarter.",
    width: 2,
    depth: 2,
  });
  const added = grown.districts.find((district) => district.id === "test-quarter");
  expect(added).toBeDefined();
  expect(grown.meta.grid.columns).toBeGreaterThanOrEqual(base.meta.grid.columns);
  expect(grown.grid.rows.every((row) => row.length === grown.meta.grid.columns)).toBe(true);
});

it("grows the map east when there is no free room, and keeps the data valid", () => {
  const grown = addDistrictToTown(base, {
    id: "far-quarter",
    name: "Far quarter",
    theme: "residential",
    traffic: "low",
    description: "A fictional far quarter.",
    width: 12,
    depth: 6,
  });
  expect(grown.meta.grid.columns).toBeGreaterThan(base.meta.grid.columns);
  expect(grown.grid.rows.every((row) => row.length === grown.meta.grid.columns)).toBe(true);
  expect(validateTownMapData(grown as never)).toEqual([]);
});

it("refuses a duplicate district id", () => {
  expect(() =>
    addDistrictToTown(base, {
      id: "olaiya",
      name: "Olaiya",
      theme: "residential",
      traffic: "low",
      description: "Duplicate.",
      width: 2,
      depth: 2,
    }),
  ).toThrow(/already exists/);
});
