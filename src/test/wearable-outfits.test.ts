import { expect, it } from "vitest";
import { resolveWornOutfit, publicWornEquipment } from "@/game/wearable-outfits";
import { worldEquipment, worldAppearance } from "@/game/world-character-view";
const top = {
  slot: "top",
  item: {
    slug: "indigo_adire_shirt",
    equippable: true,
    equipment_slot: "top",
    effects: { wearable: { slot: "top", color: "#3b5bb5", pattern: "adire", cut: "long-sleeve" } },
  },
};
it.each(["male", "female", "nonbinary"])(
  "changes the %s outfit without changing identity or base appearance",
  (gender) => {
    const base = { skin: 4, outfit: 1, hair: 2, bottoms: 0, clothed: true };
    const copy = { ...base };
    const worn = resolveWornOutfit(base, gender, [top]);
    expect(worn).toMatchObject({
      colors: ["#3b5bb5", "#27334a", "#22242a"],
      topCut: "long-sleeve",
      patterned: true,
      hasWearables: true,
    });
    expect(base).toEqual(copy);
    expect(resolveWornOutfit(base, gender, [])).toMatchObject({
      colors: ["#e8b422", "#27334a", "#22242a"],
      hasWearables: false,
    });
  },
);
it("projects only bounded cosmetic metadata and preserves it through the world snapshot", () => {
  const entry = {
    ...top,
    privateBalance: 100,
    item: {
      ...top.item,
      user_id: "secret",
      effects: { ...top.item.effects, privateKey: "secret" },
    },
  };
  const projected = publicWornEquipment([entry]);
  expect(JSON.stringify(projected)).not.toContain("secret");
  expect(worldEquipment(JSON.stringify(projected))).toEqual(projected);
  expect(resolveWornOutfit({}, "female", projected).topCut).toBe("long-sleeve");
  expect(worldAppearance('{"clothed":true,"bank":500}')).toEqual({ clothed: true });
});
it("rejects mismatched slots, invalid colors and appearance overrides", () => {
  expect(
    resolveWornOutfit({}, "female", [{ ...top, item: { ...top.item, equipment_slot: "shoes" } }])
      .hasWearables,
  ).toBe(false);
  expect(
    resolveWornOutfit({}, "female", [
      {
        ...top,
        item: {
          ...top.item,
          effects: { wearable: { slot: "top", color: "url(secret)", skin: 0 } },
        },
      },
    ]).hasWearables,
  ).toBe(false);
  expect(publicWornEquipment([{ slot: "wallet" }, top, top])).toHaveLength(1);
});
it("supports independently replacing trousers and shoes and the legacy starter outfit", () => {
  const slots = ["bottom", "shoes"].map((slot) => ({
    slot,
    item: {
      slug: slot,
      equippable: true,
      equipment_slot: slot,
      effects: { wearable: { slot, color: "#eeeeee" } },
    },
  }));
  expect(
    resolveWornOutfit({}, "male", [...slots, { slot: "top", item: { slug: "basic_outfit" } }])
      .colors,
  ).toEqual(["#e8e0cc", "#eeeeee", "#eeeeee"]);
});
