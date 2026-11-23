import { expect, it } from "vitest";
import {
  resolveWornOutfit,
  resolveNormalizedWornOutfit,
  publicWornEquipment,
} from "@/game/wearable-outfits";
import { normalizeAvatarAppearance } from "@/game/avatar-appearance";
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

it.each(["male", "female", "nonbinary"])(
  "preserves normalized outfit resolution for %s",
  (gender) => {
    const appearance = {
      skin: 4,
      outfit: 3,
      hair: 2,
      bottoms: 1,
      clothed: true,
    };
    const safe = normalizeAvatarAppearance(appearance, gender);
    for (const equipment of [[], [top]]) {
      expect(resolveNormalizedWornOutfit(safe, equipment)).toEqual(
        resolveWornOutfit(appearance, gender, equipment),
      );
    }
  },
);

it("preserves appearance fallback through the public resolver", () => {
  const appearance = { outfit: -1, bottoms: 999, shoes: 999 };
  const defaults = normalizeAvatarAppearance({}, "female");
  expect(resolveWornOutfit(appearance, "female", [])).toEqual(
    resolveNormalizedWornOutfit(defaults, []),
  );
});

it("preserves the legacy starter outfit in the normalized resolver", () => {
  const safe = normalizeAvatarAppearance({ outfit: 3 }, "male");
  expect(
    resolveNormalizedWornOutfit(safe, [{ slot: "top", item: { slug: "basic_outfit" } }]),
  ).toMatchObject({
    colors: ["#e8e0cc", "#27334a", "#22242a"],
    topCut: "tee",
    patterned: false,
    hasWearables: true,
  });
});

it("rejects invalid equipment in the normalized resolver", () => {
  const safe = normalizeAvatarAppearance({}, "female");
  const invalid = [
    { ...top, item: { ...top.item, equipment_slot: "shoes" } },
    {
      ...top,
      item: {
        ...top.item,
        effects: { wearable: { slot: "top", color: "url(secret)" } },
      },
    },
    { slot: "wallet", item: top.item },
  ];
  expect(resolveNormalizedWornOutfit(safe, invalid)).toEqual(resolveNormalizedWornOutfit(safe, []));
});

it("reflects equipment changes without stale outfit results", () => {
  const safe = normalizeAvatarAppearance({}, "male");
  const equipment = [top];
  const initial = resolveNormalizedWornOutfit(safe, equipment);
  equipment.pop();
  const updated = resolveNormalizedWornOutfit(safe, equipment);
  expect(initial.hasWearables).toBe(true);
  expect(updated.hasWearables).toBe(false);
  expect(updated.colors[0]).not.toBe(initial.colors[0]);
});

it("preserves last-valid-entry precedence for duplicate outfit slots", () => {
  const safe = normalizeAvatarAppearance({}, "male");
  const replacement = {
    ...top,
    item: {
      ...top.item,
      effects: {
        wearable: { slot: "top", color: "#112233", pattern: "plain", cut: "tee" },
      },
    },
  };
  expect(resolveNormalizedWornOutfit(safe, [top, replacement])).toMatchObject({
    topCut: "tee",
    patterned: false,
    hasWearables: true,
  });
  expect(resolveNormalizedWornOutfit(safe, [top, replacement]).colors[0]).toBe("#112233");
  expect(resolveNormalizedWornOutfit(safe, [replacement, top]).colors[0]).toBe("#3b5bb5");
});

it("does not mutate normalized appearance during outfit resolution", () => {
  const safe = Object.freeze(
    normalizeAvatarAppearance({ skin: 4, outfit: 3, hair: 2, clothed: false }, "female"),
  );
  const before = { ...safe };
  const worn = resolveNormalizedWornOutfit(safe, [top]);
  expect(worn.hasWearables).toBe(true);
  expect(safe).toEqual(before);
});
