import { describe, expect, it } from "vitest";
import { mapHousingMarkers } from "@/components/map/map-housing-markers";

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
        position: [-11, 0, -7],
      },
    ]);
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
