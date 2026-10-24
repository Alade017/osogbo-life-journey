import type { HousePlacement, HouseSlot } from "./HouseRoomScene";

export type HomeRenderer = "r3f" | "playcanvas";
export function homeRendererChoice(value: unknown): HomeRenderer {
  return value === "playcanvas" ? "playcanvas" : "r3f";
}

export type HouseRoomRendererProps = {
  houseTypeId: string;
  accessoryBand: string;
  slots: HouseSlot[];
  placements: HousePlacement[];
  editMode: boolean;
  moveEnabled: boolean;
  onSelectPlacement: (placement: HousePlacement) => void;
  onSelectSlot: (slot: HouseSlot) => void;
  onMove: (placement: HousePlacement, slot: HouseSlot) => void;
};

export const HOUSE_ROOM_SIZE: Record<string, readonly [number, number]> = {
  "shared-room": [4.2, 3.4],
  "single-room": [5, 3.8],
  "studio-flat": [6.4, 4.5],
  "mini-flat": [7.4, 5.4],
  bungalow: [8.7, 6.5],
  duplex: [9.6, 7.2],
};
export const HOUSE_ACCESSORY_TIER: Record<string, number> = {
  basic: 1,
  comfortable: 2,
  premium: 3,
};

export function houseSlotPosition(
  slot: HouseSlot,
  width: number,
  depth: number,
): [number, number, number] {
  return [(slot.x / 100 - 0.5) * (width - 0.8), 0.2, (0.5 - slot.y / 100) * (depth - 0.8)];
}
