import { describe, expect, it } from "vitest";
import { ITEM_MODELS } from "@/components/3d/item-models";
import { hasItemModel } from "@/components/3d/ItemPreview3D";
import {
  WORN_BOTTOMS,
  WORN_CLOTHING,
  WORN_ITEM_MODELS,
  WORN_SHOES,
} from "@/components/3d/world-item-models";

describe("3D item registries", () => {
  it("shows a 3D model in the bag for every catalogue item that has one", () => {
    for (const slug of [
      "jollof_rice",
      "zobo",
      "water_bottle",
      "water_nature",
      "basic_outfit",
      "backpack",
      "sokoto",
      "slippers",
    ]) {
      expect(hasItemModel(slug), slug).toBe(true);
    }
  });

  it("wears the right model for each slot", () => {
    expect(WORN_ITEM_MODELS["backpack"]).toBeDefined();
    expect(WORN_CLOTHING["basic_outfit"]).toBeDefined();
    expect(WORN_BOTTOMS["sokoto"]).toBeDefined();
    expect(WORN_SHOES["slippers"]).toBeDefined();
  });

  it("does not register models for items without one", () => {
    expect(hasItemModel("phone")).toBe(false);
    expect(hasItemModel(null)).toBe(false);
    expect(ITEM_MODELS["phone"]).toBeUndefined();
  });
});
