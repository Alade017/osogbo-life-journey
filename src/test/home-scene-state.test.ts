import { describe, expect, it } from "vitest";
import { homeSceneFromAuthoritativeState } from "@/lib/home-scene-state";

describe("Home scene state", () => {
  it("maps authoritative placements and outfit slots into the home scene", () => {
    const result = homeSceneFromAuthoritativeState({
      house: {
        id: "home-1",
        house_type_id: "studio-flat",
        house_type: {
          label: "Studio flat",
          asset_key: "studio-flat",
          slots: [{ id: "seat", slot_type: "seat", x: 55, y: 71, z: 3 }],
        },
      },
      placements: [
        {
          id: "placement-1",
          item_id: "starter-seat",
          slot: "seat",
          slot_type: "seat",
        },
      ],
      outfit: { top: "green-shirt", bottom: null, shoes: null, head: null, accessory: null },
      inventory: [],
    });

    expect(result?.home?.house_types.asset_key).toBe("studio-flat");
    expect(result?.home_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "starter-seat",
          slot_id: "seat",
          x: 55,
          y: 71,
          z: 3,
          placed: true,
        }),
        expect.objectContaining({ item_id: "green-shirt", slot_type: "top", equipped: true }),
      ]),
    );
  });

  it("returns an explicit empty state when the player has no home", () => {
    expect(homeSceneFromAuthoritativeState({ house: null })).toEqual({
      home: null,
      home_items: [],
    });
  });
});
