import { bungalowBlueprint } from "./bungalow-blueprint";
import { duplexBlueprint } from "./duplex-blueprint";

/** Architectural boundaries in room metres. Rendering and movement consume these together. */
export type FloorBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type BlueprintDoor = { id: string; axis: "x" | "z"; x: number; z: number; width: number };

export const STUDIO_FINISH = {
  plaster: "#dbc9ac",
  trim: "#665545",
  tile: "#e4d7c0",
  tileAlternate: "#dfd0b8",
  grout: "#c3b39b",
  wetTile: "#a8ada3",
  gymFloor: "#626e65",
  wood: "#a4784d",
  woodAlternate: "#b18658",
  sage: "#677357",
  curtain: "#c5aa76",
  glass: "#afc7bf",
  brass: "#b79654",
  rug: "#a98a58",
  rugBorder: "#5b6e58",
} as const;

export function studioBlueprint(width: number, depth: number) {
  const whole: FloorBounds = {
    minX: -width / 2,
    maxX: width / 2,
    minZ: -depth / 2,
    maxZ: depth / 2,
  };
  // Retain the existing wet quadrant so a redesign never relocates saved bathroom fittings.
  const bathroom: FloorBounds = { minX: 0, maxX: width / 2, minZ: 0, maxZ: depth / 2 };
  const doorwayWidth = 1.1;
  return {
    whole,
    bathroom,
    sleep: { minX: -width / 2, maxX: 0, minZ: 0, maxZ: depth / 2 } satisfies FloorBounds,
    entranceX: -width * 0.25,
    bathroomDoor: { x: bathroom.minX, z: depth * 0.25, width: doorwayWidth },
    windows: [-depth * 0.25, depth * 0.25],
    windowWidth: depth * 0.22,
    interiorDoors: [
      { id: "studio-bathroom-door", axis: "z", x: 0, z: depth * 0.25, width: doorwayWidth },
    ] satisfies BlueprintDoor[],
  };
}

/** Shared bedroom shell: the room's kitchen and washing facilities are not private rooms. */
export function sharedRoomBlueprint(width: number, depth: number) {
  return {
    whole: { minX: -width / 2, maxX: width / 2, minZ: -depth / 2, maxZ: depth / 2 },
    bathroom: null,
    bathroomDoor: null,
    sleep: null,
    entranceX: width * 0.22,
    windows: [0],
    windowWidth: depth * 0.42,
    interiorDoors: [] as BlueprintDoor[],
  };
}

/** A private bedroom with household facilities shared outside the room. */
export function privateRoomBlueprint(width: number, depth: number) {
  return {
    whole: { minX: -width / 2, maxX: width / 2, minZ: -depth / 2, maxZ: depth / 2 },
    bathroom: null,
    bathroomDoor: null,
    sleep: { minX: -width / 2, maxX: -width * 0.06, minZ: -depth / 2, maxZ: depth * 0.25 },
    entranceX: width * 0.22,
    windows: [-depth * 0.15],
    windowWidth: depth * 0.4,
    interiorDoors: [] as BlueprintDoor[],
  };
}

/** Keep the established four-room boundaries and existing furniture coordinates. */
export function miniFlatBlueprint(width: number, depth: number) {
  return {
    ...studioBlueprint(width, depth),
    interiorDoors: [
      { id: "mini-bedroom-door", axis: "x", x: -width * 0.25, z: 0, width: 1.1 },
      { id: "mini-kitchen-door", axis: "z", x: 0, z: -depth * 0.25, width: 1.1 },
      { id: "mini-bathroom-door", axis: "z", x: 0, z: depth * 0.25, width: 1.1 },
    ] satisfies BlueprintDoor[],
  };
}

export const HOUSE_BLUEPRINTS = {
  "studio-flat": studioBlueprint,
  "shared-room": sharedRoomBlueprint,
  "single-room": privateRoomBlueprint,
  "mini-flat": miniFlatBlueprint,
  bungalow: bungalowBlueprint,
  duplex: duplexBlueprint,
} as const;
export type BlueprintHomeType = keyof typeof HOUSE_BLUEPRINTS;

export function isBlueprintHomeType(houseTypeId: string): houseTypeId is BlueprintHomeType {
  return Object.hasOwn(HOUSE_BLUEPRINTS, houseTypeId);
}

export function boundsContain(bounds: FloorBounds, x: number, z: number, margin = 0) {
  return (
    x >= bounds.minX - margin &&
    x <= bounds.maxX + margin &&
    z >= bounds.minZ - margin &&
    z <= bounds.maxZ + margin
  );
}
