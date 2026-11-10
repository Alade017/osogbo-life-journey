import type { HousePlacement, HouseSlot } from "@/components/game/housing/HouseRoomScene";

/** A friend's current house, as get_friend_house_for_visit returns it. Read-only. */
export type FriendHouse = {
  ownerName: string;
  houseTypeId: string;
  wallsClosed: boolean | null;
  slots: HouseSlot[];
  placements: HousePlacement[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSlot(value: unknown): HouseSlot | null {
  if (!isRecord(value)) return null;
  const { id, slot_type: slotType, x, y } = value;
  if (typeof id !== "string" || typeof slotType !== "string") return null;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return { id, slot_type: slotType, x, y };
}

function toPlacement(value: unknown): HousePlacement | null {
  if (!isRecord(value)) return null;
  const { id, item_id: itemId, slot, art_key: artKey, category, slot_type: slotType } = value;
  if (
    typeof id !== "string" ||
    typeof itemId !== "string" ||
    typeof slot !== "string" ||
    typeof artKey !== "string" ||
    typeof category !== "string" ||
    typeof slotType !== "string"
  )
    return null;
  const { x, y, rotation_deg: rotation, floor } = value;
  return {
    id,
    item_id: itemId,
    slot,
    art_key: artKey,
    category,
    slot_type: slotType,
    ...(typeof x === "number" ? { x } : {}),
    ...(typeof y === "number" ? { y } : {}),
    ...(typeof rotation === "number" ? { rotation_deg: rotation } : {}),
    ...(typeof floor === "number" ? { floor } : {}),
  };
}

/** Reads the RPC response. Anything malformed is treated as a home that cannot be shown. */
export function parseFriendHouse(data: unknown): FriendHouse | null {
  if (!isRecord(data) || !isRecord(data["house"])) return null;
  const house = data["house"];
  const houseTypeId = house["house_type_id"];
  if (typeof houseTypeId !== "string") return null;
  const houseType = isRecord(house["house_type"]) ? house["house_type"] : null;
  const rawSlots = houseType?.["slots"];
  const rawPlacements = data["placements"];
  const slots = Array.isArray(rawSlots)
    ? rawSlots.map(toSlot).filter((slot): slot is HouseSlot => slot !== null)
    : [];
  const placements = Array.isArray(rawPlacements)
    ? rawPlacements
        .map(toPlacement)
        .filter((placement): placement is HousePlacement => placement !== null)
    : [];
  const ownerName = data["owner_name"];
  const wallsClosed = house["walls_closed"];
  return {
    ownerName: typeof ownerName === "string" ? ownerName : "your friend",
    houseTypeId,
    wallsClosed: typeof wallsClosed === "boolean" ? wallsClosed : null,
    slots,
    placements,
  };
}
