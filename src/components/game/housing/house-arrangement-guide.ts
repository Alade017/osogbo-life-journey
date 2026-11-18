import {
  FOUR_ROOM_HOME_TYPES,
  isWallArtKind,
  HOUSE_ROOM_SIZE,
  roomCoordinatesToPercent,
  type GuideZoneBounds,
} from "./house-room-contract";
import { duplexBlueprint } from "./duplex-blueprint";
import { bungalowBlueprint } from "./bungalow-blueprint";
import { boundsContain } from "./house-blueprints";

function blueprintGuideBounds(
  slotType: string,
  artKey: string,
  houseTypeId: "bungalow" | "duplex" = "bungalow",
  floor: 0 | 1 = 0,
): GuideZoneBounds | null {
  const [width, depth] = HOUSE_ROOM_SIZE[houseTypeId]!;
  const plan =
    houseTypeId === "duplex"
      ? duplexBlueprint(width, depth, floor)
      : bungalowBlueprint(width, depth);
  const id =
    slotType === "fitness"
      ? "gym"
      : slotType === "bed" || slotType === "storage" || slotType === "light"
        ? "bedroom-2"
        : slotType === "bathroom"
          ? "bathroom"
          : slotType === "kitchen"
            ? "kitchen"
            : artKey === "dining-table" || artKey === "dining-chair"
              ? "dining"
              : "sitting";
  const target =
    houseTypeId === "duplex" && id === "bedroom-2" && floor === 0
      ? "bedroom"
      : houseTypeId === "duplex" && id === "kitchen" && floor === 1
        ? "study"
        : id;
  const room = plan.rooms.find((room) => room.id === target);
  if (!room) return null;
  const [x0, y1] = roomCoordinatesToPercent(room.minX, room.minZ, width, depth);
  const [x1, y0] = roomCoordinatesToPercent(room.maxX, room.maxZ, width, depth);
  return { x0, x1, y0, y1 };
}

/** Zones of the room, in room percent: x runs left to right, y runs front (0) to back (100). */
export const GUIDE_ZONE_BOUNDS = {
  sleep: { x0: 0, x1: 50, y0: 50, y1: 100 },
  living: { x0: 20, x1: 80, y0: 30, y1: 100 },
  kitchen: { x0: 50, x1: 100, y0: 50, y1: 100 },
  wet: { x0: 50, x1: 100, y0: 0, y1: 50 },
} satisfies Record<string, GuideZoneBounds>;

export type GuideZoneName = keyof typeof GUIDE_ZONE_BOUNDS;

type GuideRule = { hint: string; zone: GuideZoneName | null };

/** Recommended places from the room arrangement guide, keyed by item slot type. */
const GUIDE_RULES: Record<string, GuideRule> = {
  bed: { hint: "Against a wall in the sleep corner, with one side open.", zone: "sleep" },
  storage: { hint: "Against the bed's wall, or at the foot of the bed.", zone: "sleep" },
  light: { hint: "Beside the bed, on the left or right.", zone: "sleep" },
  seat: { hint: "Against a solid wall, facing the TV or window.", zone: "living" },
  device: { hint: "Across from the sofa, at a comfortable viewing distance.", zone: "living" },
  table: { hint: "In front of or beside the sofa.", zone: "living" },
  kitchen: { hint: "Against a wall on the right, near the sink.", zone: "kitchen" },
  bathroom: { hint: "On the wet tiles, front right.", zone: "wet" },
  plant: { hint: "In a corner or on a wall, clear of the paths.", zone: null },
  decor: { hint: "On a wall or in a corner, clear of the paths.", zone: null },
};

export type ArrangementGuide = { hint: string; zoneBounds: GuideZoneBounds | null };

/** The suggestion for an item, or null when the guide has nothing for it. Wall art is handled separately. */
export function guideFor(
  slotType: string,
  artKey: string,
  houseTypeId?: string,
  floor: 0 | 1 = 0,
): ArrangementGuide | null {
  if (isWallArtKind(artKey)) {
    return { hint: "On the back wall. Slide it to where you want it.", zoneBounds: null };
  }
  if (houseTypeId === "duplex" && floor === 1 && slotType === "kitchen")
    return { hint: "Place cooking appliances in the downstairs kitchen.", zoneBounds: null };
  if (houseTypeId === "bungalow" && slotType === "fitness")
    return {
      hint: "In the shared gym, leaving space around equipment and the door.",
      zoneBounds: blueprintGuideBounds(slotType, artKey),
    };
  const rule = GUIDE_RULES[slotType];
  if (!rule) return null;
  if (houseTypeId === "bungalow" || houseTypeId === "duplex")
    return {
      hint:
        slotType === "bathroom"
          ? "In the common bathroom or master ensuite, clear of the door."
          : slotType === "bed" || slotType === "storage" || slotType === "light"
            ? "In any bedroom, keeping space beside the bed and door."
            : rule.hint,
      zoneBounds: rule.zone ? blueprintGuideBounds(slotType, artKey, houseTypeId, floor) : null,
    };
  return { hint: rule.hint, zoneBounds: rule.zone ? GUIDE_ZONE_BOUNDS[rule.zone] : null };
}

/** Where the entrance door sits on the back wall, in room percent. */
export function houseDoorPercentX(houseTypeId: string): number {
  return houseTypeId === "studio-flat" ||
    houseTypeId === "bungalow" ||
    FOUR_ROOM_HOME_TYPES.includes(houseTypeId)
    ? 22
    : 74;
}

const SOFT_SLOT_TYPES = new Set(["bed", "seat"]);

/**
 * Notes for a placement that goes against the guide. They inform only: a player can
 * still place the item where they choose.
 */
export function arrangementWarnings(
  slotType: string,
  artKey: string,
  x: number,
  y: number,
  doorX: number,
  houseTypeId?: string,
  floor: 0 | 1 = 0,
): string[] {
  if (isWallArtKind(artKey)) return [];
  let inWet = x > 50 && y < 50;
  let inSleep = x <= 50 && y >= 50;
  if (houseTypeId === "bungalow" || houseTypeId === "duplex") {
    const [width, depth] = HOUSE_ROOM_SIZE[houseTypeId]!;
    const plan =
      houseTypeId === "duplex"
        ? duplexBlueprint(width, depth, floor)
        : bungalowBlueprint(width, depth);
    const px = (x / 100 - 0.5) * (width - 0.8),
      pz = (0.5 - y / 100) * (depth - 0.8);
    inWet = plan.wetAreas.some((area) => boundsContain(area, px, pz));
    inSleep = plan.rooms.some(
      (room) =>
        room.id.startsWith("bedroom") &&
        boundsContain(room, px, pz) &&
        !("exclude" in room && room.exclude && boundsContain(room.exclude, px, pz)),
    );
  }
  const notes: string[] = [];
  const againstWall = x <= 12 || x >= 88 || y >= 88;
  if (slotType === "bed" && !againstWall) {
    notes.push("Beds sit best against a wall, ideally in a corner.");
  }
  if (SOFT_SLOT_TYPES.has(slotType) && inWet) {
    notes.push("Keep soft furniture off the wet tiles.");
  }
  if (slotType === "bathroom" && !inWet) {
    notes.push("Shower, toilet and sink belong on the wet tiles.");
  }
  if (slotType === "kitchen" && inSleep) {
    notes.push("Cooking items sit on the right side, near the sink.");
  }
  if (Math.abs(x - doorX) <= 10 && y >= 50) {
    notes.push("Keep the path from the door clear.");
  }
  return notes;
}
