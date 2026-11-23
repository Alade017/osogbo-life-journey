import {
  normalizeAvatarAppearance,
  OUTFITS,
  SHOE_COLORS,
  TROUSERS,
  type Appearance,
} from "./avatar-appearance.ts";
export type WearableEquipment = {
  slot: string;
  item?: {
    slug?: string | null;
    equippable?: boolean;
    equipment_slot?: string | null;
    effects?: unknown;
  } | null;
};
export type TopCut = "tee" | "long-sleeve";
export type WornOutfit = {
  colors: readonly [string, string, string];
  topCut: TopCut;
  patterned: boolean;
  hasWearables: boolean;
};
const OUTFIT_SLOTS: readonly string[] = ["top", "bottom", "shoes"];
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
/** Render only bounded cosmetic metadata. Ownership and equipping remain server-authoritative. */
export function resolveWornOutfit(
  appearance: Appearance,
  gender: string,
  equipment: readonly WearableEquipment[],
): WornOutfit {
  return resolveNormalizedWornOutfit(normalizeAvatarAppearance(appearance, gender), equipment);
}

export function resolveNormalizedWornOutfit(
  safe: Readonly<Required<Appearance>>,
  equipment: readonly WearableEquipment[],
): WornOutfit {
  const colors: [string, string, string] = [
    OUTFITS[safe.outfit]!,
    TROUSERS[safe.bottoms]!,
    SHOE_COLORS[safe.shoes]!,
  ];
  const result: WornOutfit = {
    colors,
    topCut: "tee",
    patterned: safe.outfit === 3,
    hasWearables: false,
  };
  for (const entry of equipment) {
    const slot = entry.slot,
      index = OUTFIT_SLOTS.indexOf(slot);
    if (index < 0) continue;
    // Existing starter equipment predates cosmetic metadata.
    if (slot === "top" && entry.item?.slug === "basic_outfit") {
      colors[0] = "#e8e0cc";
      result.topCut = "tee";
      result.patterned = false;
      result.hasWearables = true;
      continue;
    }
    if (entry.item?.equippable !== true || entry.item.equipment_slot !== slot) continue;
    const effects = entry.item.effects,
      wearable = record(effects) ? effects["wearable"] : null;
    if (
      !record(wearable) ||
      wearable["slot"] !== slot ||
      typeof wearable["color"] !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(wearable["color"])
    )
      continue;
    colors[index] = wearable["color"];
    result.hasWearables = true;
    if (slot === "top") {
      result.topCut = wearable["cut"] === "long-sleeve" ? "long-sleeve" : "tee";
      result.patterned = wearable["pattern"] === "adire";
    }
  }
  return result;
}

/** Only public cosmetic fields cross the multiplayer boundary. No inventory or economy data. */
export function publicWornEquipment(value: unknown): WearableEquipment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: WearableEquipment[] = [];
  for (const row of value.slice(0, 32)) {
    if (
      !record(row) ||
      typeof row["slot"] !== "string" ||
      !["head", "top", "bottom", "shoes", "accessory"].includes(row["slot"]) ||
      seen.has(row["slot"])
    )
      continue;
    const slot = row["slot"];
    seen.add(slot);
    const entry: WearableEquipment = { slot };
    const item = row["item"];
    if (
      record(item) &&
      typeof item["slug"] === "string" &&
      /^[a-z0-9_-]{1,80}$/.test(item["slug"])
    ) {
      entry.item = { slug: item["slug"] };
      const effects = item["effects"],
        wearable = record(effects) ? effects["wearable"] : null;
      if (
        item["equippable"] === true &&
        item["equipment_slot"] === slot &&
        record(wearable) &&
        wearable["slot"] === slot &&
        typeof wearable["color"] === "string" &&
        /^#[0-9a-f]{6}$/i.test(wearable["color"])
      ) {
        entry.item.equippable = true;
        entry.item.equipment_slot = slot;
        entry.item.effects = {
          wearable: {
            slot,
            color: wearable["color"],
            ...(slot === "top"
              ? {
                  cut: wearable["cut"] === "long-sleeve" ? "long-sleeve" : "tee",
                  pattern: wearable["pattern"] === "adire" ? "adire" : "plain",
                }
              : {}),
          },
        };
      }
    }
    result.push(entry);
  }
  return result;
}

/** Only recognized inventory headwear receives a 3D model; legacy cosmetics are ignored. */
export function resolveEquippedHeadwear(equipment: readonly WearableEquipment[]): 0 | 1 | 2 | 3 {
  const head = equipment.find((entry) => entry.slot === "head");
  const slug = head?.item?.slug;
  if (!slug) return 0;
  const styles: Readonly<Record<string, 1 | 2 | 3>> = {
    gele: 1,
    fila: 2,
    cap: 3,
  };
  return styles[slug] ?? 0;
}
