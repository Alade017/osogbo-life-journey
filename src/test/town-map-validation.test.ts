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

    expect(errors.some((error) => error.includes("does not match grid metadata") || error.includes("expected 24"))).toBe(true);
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
});
