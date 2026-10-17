export type HomeSceneItem = {
  id: string;
  item_id: string;
  slot_type: string;
  slot_id: string | null;
  x: number;
  y: number;
  z: number;
  placed: boolean;
  equipped: boolean;
};

type HomeSceneSlot = { id: string; slot_type: string; x?: number; y?: number; z?: number };

export type HomeScenePayload = {
  home: null | {
    id: string;
    house_type_id: string;
    house_types: {
      label: string;
      asset_key: string;
      slots: HomeSceneSlot[];
    };
  };
  home_items: HomeSceneItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function homeSceneFromAuthoritativeState(value: unknown): HomeScenePayload | null {
  if (!isRecord(value) || !("house" in value)) return null;
  if (value["house"] === null) return { home: null, home_items: [] };
  const house = value["house"];
  if (!isRecord(house) || !isRecord(house["house_type"])) return null;
  const houseType = house["house_type"];
  if (
    typeof house["id"] !== "string" ||
    typeof house["house_type_id"] !== "string" ||
    typeof houseType["label"] !== "string" ||
    typeof houseType["asset_key"] !== "string"
  )
    return null;
  const slots = Array.isArray(houseType["slots"]) ? (houseType["slots"] as HomeSceneSlot[]) : [];
  const placements = Array.isArray(value["placements"]) ? value["placements"] : [];
  const homeItems: HomeSceneItem[] = placements.flatMap((entry, index) => {
    if (!isRecord(entry) || typeof entry["item_id"] !== "string") return [];
    const slotId = typeof entry["slot"] === "string" ? entry["slot"] : null;
    const slot = slots.find((candidate) => candidate.id === slotId);
    if (!slotId || !slot) return [];
    return [
      {
        id: typeof entry["id"] === "string" ? entry["id"] : `placement-${index}`,
        item_id: entry["item_id"],
        slot_type: typeof entry["slot_type"] === "string" ? entry["slot_type"] : slot.slot_type,
        slot_id: slotId,
        x: Number(slot.x ?? 50),
        y: Number(slot.y ?? 50),
        z: Number(slot.z ?? index + 1),
        placed: true,
        equipped: false,
      },
    ];
  });
  const outfit = isRecord(value["outfit"]) ? value["outfit"] : {};
  for (const slot of ["bottom", "top", "shoes", "head", "accessory"] as const) {
    const itemId = outfit[slot];
    if (typeof itemId !== "string") continue;
    homeItems.push({
      id: `outfit-${slot}`,
      item_id: itemId,
      slot_type: slot,
      slot_id: null,
      x: 50,
      y: 74,
      z: 100,
      placed: false,
      equipped: true,
    });
  }
  return {
    home: {
      id: house["id"],
      house_type_id: house["house_type_id"],
      house_types: { label: houseType["label"], asset_key: houseType["asset_key"], slots },
    },
    home_items: homeItems,
  };
}
