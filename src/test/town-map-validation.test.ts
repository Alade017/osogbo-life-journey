import { describe, expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { validateTownMapData } from "@/game/town-map-validation";

describe("authored town map validation", () => {
  it("accepts the current data-driven town layout", () => {
    expect(validateTownMapData(town)).toEqual([]);
  });

  it("detects grid dimension and terrain-overlay errors", () => {
    const invalid = JSON.parse(JSON.stringify(town)) as typeof town;
    invalid.grid.rows[0] = (invalid.grid.rows[0] ?? "") + "g";
    invalid.grid.waterCells.push([6, 0]);

    const errors = validateTownMapData(invalid);

    expect(
      errors.some(
        (error) =>
          error.includes("does not match grid metadata") ||
          error.includes(`expected ${town.meta.grid.columns}`),
      ),
    ).toBe(true);
    expect(errors.some((error) => error.includes("must be placed on a grass tile"))).toBe(true);
  });

  it("detects missing landmark references and out-of-bounds districts", () => {
    const invalid = JSON.parse(JSON.stringify(town)) as typeof town;
    invalid.grid.buildings[0]!.placeId = "missing-landmark";
    invalid.districts[0]!.gridArea.width = invalid.meta.grid.columns + 1;

    const errors = validateTownMapData(invalid);

    expect(errors.some((error) => error.includes("has no matching landmark"))).toBe(true);
    expect(errors.some((error) => error.includes("invalid or out-of-bounds"))).toBe(true);
  });

  it("detects overlapping districts and malformed outlines", () => {
    const invalid = JSON.parse(JSON.stringify(town)) as typeof town;
    invalid.districts[0]!.gridArea.x = invalid.districts[1]!.gridArea.x;
    invalid.districts[0]!.shape = [
      [0, 0],
      [Number.NaN, 2],
    ];

    const errors = validateTownMapData(invalid);

    expect(errors.some((error) => error.includes("overlap"))).toBe(true);
    expect(errors.some((error) => error.includes("outline shape"))).toBe(true);
  });

  it("detects building-road and landmark-district conflicts", () => {
    const invalid = JSON.parse(JSON.stringify(town)) as typeof town;
    const building = invalid.grid.buildings[0]!;
    const row = [...invalid.grid.rows[building.z]!];
    row[building.x] = "r";
    invalid.grid.rows[building.z] = row.join("");
    const landmark = invalid.landmarks.find((place) => place.id === building.placeId)!;
    landmark.districtId = invalid.districts.find(
      (district) => district.id !== landmark.districtId,
    )!.id;

    const errors = validateTownMapData(invalid);

    expect(errors.some((error) => error.includes("overlaps a road"))).toBe(true);
    expect(errors.some((error) => error.includes("outside its assigned district"))).toBe(true);
  });

  it("detects roads and buildings placed on reserved terrain", () => {
    const roadConflict = JSON.parse(JSON.stringify(town)) as typeof town;

    const waterCell = roadConflict.grid.waterCells[0];

    if (!waterCell || waterCell[0] === undefined || waterCell[1] === undefined) {
      throw new Error("Test setup requires a valid water cell.");
    }

    const [waterX, waterZ] = waterCell;
    const originalRow = roadConflict.grid.rows[waterZ];

    if (originalRow === undefined) {
      throw new Error("Test setup requires a valid water row.");
    }

    const row = [...originalRow];
    row[waterX] = "r";
    roadConflict.grid.rows[waterZ] = row.join("");

    expect(
      validateTownMapData(roadConflict).some(
        (error) => error.includes("Road cell") && error.includes("reserved water"),
      ),
    ).toBe(true);

    const buildingConflict = JSON.parse(JSON.stringify(town)) as typeof town;

    const plotCell = buildingConflict.grid.plotCells[0];

    if (!plotCell || plotCell[0] === undefined || plotCell[1] === undefined) {
      throw new Error("Test setup requires a valid plot cell.");
    }

    const [plotX, plotZ] = plotCell;
    const building = buildingConflict.grid.buildings[0];

    if (!building) {
      throw new Error("Test setup requires a building.");
    }

    building.x = plotX;
    building.z = plotZ;

    const landmark = buildingConflict.landmarks.find((item) => item.id === building.placeId);

    if (!landmark) {
      throw new Error("Test setup requires the building's landmark.");
    }

    landmark.grid.x = plotX;
    landmark.grid.z = plotZ;

    expect(
      validateTownMapData(buildingConflict).some((error) =>
        error.includes("overlaps reserved plot terrain"),
      ),
    ).toBe(true);
  });
});
