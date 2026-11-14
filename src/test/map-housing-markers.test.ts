import { describe, expect, it } from "vitest";
import { mapHousingMarkers } from "@/components/map/map-housing-markers";
import town from "@/data/osogbo-town.json";

// The town grid's size and cell size come from the data, so these expectations follow any resize.
const columns = town.grid.rows[0]!.length;
const rows = town.grid.rows.length;
const cellSize = town.grid.cellSize;
const sceneX = (gridX: number) => (gridX - (columns - 1) / 2) * cellSize;
const sceneZ = (gridZ: number) => (gridZ - (rows - 1) / 2) * cellSize;

describe("housing map marker input", () => {
  it("projects the server plot and preserves its rent status", () => {
    expect(
      mapHousingMarkers([
        {
          propertyId: "property-1",
          label: "Shared room",
          model: "compound",
          gridX: 1,
          gridZ: 1,
          tier: 2,
          status: "rent_due",
        },
      ]),
    ).toEqual([
      {
        id: "property-1",
        label: "Shared room",
        type: "compound",
        tier: 2,
        status: "rent_due",
        position: [sceneX(1), 0, sceneZ(1)],
      },
    ]);
  });

  it("accepts the expanded town edge and rejects coordinates beyond it", () => {
    const marker = {
      propertyId: "edge-home",
      label: "Room",
      model: "flat",
      gridX: 23,
      gridZ: 17,
      tier: 1,
      status: "current",
    };

    expect(mapHousingMarkers([marker])).toEqual([
      expect.objectContaining({ id: "edge-home", position: [sceneX(23), 0, sceneZ(17)] }),
    ]);

    expect(
      mapHousingMarkers([
        { ...marker, gridX: 24 },
        { ...marker, gridZ: 18 },
      ]),
    ).toEqual([]);
  });

  it("drops invalid rows instead of inventing a property status", () => {
    expect(
      mapHousingMarkers([
        { propertyId: "missing-status", label: "Room", model: "flat", gridX: 1, gridZ: 1, tier: 1 },
        {
          propertyId: "bad-plot",
          label: "Room",
          model: "flat",
          gridX: 50,
          gridZ: 1,
          tier: 1,
          status: "vacant",
        },
      ]),
    ).toEqual([]);
  });
});
