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

    expect(errors.some((error) => error.includes("does not match grid metadata") || error.includes(`expected ${town.meta.grid.columns}`))).toBe(true);
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
    invalid.districts[0]!.shape = [[0, 0], [Number.NaN, 2]];

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
    landmark.districtId = invalid.districts.find((district) => district.id !== landmark.districtId)!.id;

    const errors = validateTownMapData(invalid);

    expect(errors.some((error) => error.includes("overlaps a road"))).toBe(true);
    expect(errors.some((error) => error.includes("outside its assigned district"))).toBe(true);
  });

  it("detects disconnected road networks", () => {
    const disconnected = {
      meta: {
        grid: { columns: 3, rows: 3, cellSize: 1 },
        legend: { g: "grass", r: "road" },
      },
      districts: [],
      landmarks: [],
      grid: {
        cellSize: 1,
        rows: ["rgg", "ggg", "ggr"],
        waterCells: [],
        plotCells: [],
        buildings: [],
      },
    };

    expect(validateTownMapData(disconnected).some((error) => error.includes("Road network is disconnected"))).toBe(true);
  });

  it("detects overlapping building footprints", () => {
    const invalid = JSON.parse(JSON.stringify(town)) as typeof town;
    const first = invalid.grid.buildings[0]!;
    const second = invalid.grid.buildings[1]!;
    second.x = first.x;
    second.z = first.z;
    const errors = validateTownMapData(invalid);
    expect(errors.some((error) => error.includes("Buildings") && error.includes("overlap at"))).toBe(true);
  });

  it("detects roads and buildings placed on reserved terrain", () => {
    const roadConflict = JSON.parse(JSON.stringify(town)) as typeof town;
    const [waterX, waterZ] = roadConflict.grid.waterCells[0]!;
    const row = [...roadConflict.grid.rows[waterZ]!];
    row[waterX] = "r";
    roadConflict.grid.rows[waterZ] = row.join("");
    expect(validateTownMapData(roadConflict).some((error) =>
      error.includes("Road cell") && error.includes("reserved water"),
    )).toBe(true);

    const buildingConflict = JSON.parse(JSON.stringify(town)) as typeof town;
    const [plotX, plotZ] = buildingConflict.grid.plotCells[0]!;
    const building = buildingConflict.grid.buildings[0]!;
    building.x = plotX;
    building.z = plotZ;
    const landmark = buildingConflict.landmarks.find((item) => item.id === building.placeId)!;
    landmark.grid.x = plotX;
    landmark.grid.z = plotZ;
    expect(validateTownMapData(buildingConflict).some((error) =>
      error.includes("overlaps reserved plot terrain"),
    )).toBe(true);
  });

  it("detects a cell assigned to both water and plot terrain", () => {
    const invalid = JSON.parse(JSON.stringify(town)) as typeof town;
    invalid.grid.plotCells.push([...invalid.grid.waterCells[0]!]);
    expect(validateTownMapData(invalid).some((error) =>
      error.includes("assigned to both water and plot"),
    )).toBe(true);
  });
});
