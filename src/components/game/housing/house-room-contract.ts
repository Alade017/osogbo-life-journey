import type { HousePlacement, HouseSlot } from "./HouseRoomScene";
import type { AvatarAnimationState, AvatarEquipment } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import type { FoodDelivery } from "@/lib/food-delivery-service";

export type HouseRoomRendererProps = {
  houseTypeId: string;
  accessoryBand: string;
  slots: HouseSlot[];
  placements: HousePlacement[];
  characterName?: string;
  appearance?: Appearance;
  gender?: string;
  equipment?: readonly AvatarEquipment[];
  animationState?: AvatarAnimationState;
  actorPosition?: [number, number, number];
  actorFacing?: string;
  taskPose?: "sit" | "wash" | "cook" | "collect" | "stretch";
  onWalk?: (point: [number, number, number]) => void;
  onCollectPackage?: (id: string) => void;
  activityRequestId?: string | null;
  activityLabel?: string | null;
  movingPlacement?: HousePlacement | null;
  foodDeliveries?: FoodDelivery[];
  editMode: boolean;
  moveEnabled: boolean;
  onSelectPlacement: (placement: HousePlacement) => void;
  onSelectSlot: (slot: HouseSlot) => void;
  onMove: (placement: HousePlacement, slot: HouseSlot) => void;
  onMovePosition: (placement: HousePlacement, x: number, y: number) => void;
  /** Placement mode: the item being moved, shown at its draft spot until placed. */
  draftMove?: DraftMove | null;
  /** Placement mode: called when the draft item is dragged to a new grid cell. */
  onDraftMove?: (x: number, y: number) => void;
};

export const HOUSE_ROOM_SIZE: Record<string, readonly [number, number]> = {
  "shared-room": [5.9, 4.8],
  "single-room": [6.8, 5.3],
  "studio-flat": [8.6, 6.4],
  "mini-flat": [9.9, 7.5],
  bungalow: [11.5, 8.6],
  duplex: [13.2, 9.7],
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

export function interpolateRoomPosition(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  progress: number,
): [number, number, number] {
  const amount = Math.max(0, Math.min(1, progress));
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

/** An item being moved in placement mode, not saved until the player places it. */
export type DraftMove = { placementId: string; x: number; y: number };

/** Where a placement starts when it is picked up: its saved spot, or its fixed slot. */
export function draftStartFor(
  placement: HousePlacement,
  slots: HouseSlot[],
): { x: number; y: number } | null {
  if (Number.isFinite(placement.x) && Number.isFinite(placement.y)) {
    return { x: placement.x as number, y: placement.y as number };
  }
  const slot = slots.find((item) => item.id === placement.slot);
  return slot ? { x: slot.x, y: slot.y } : null;
}

/** Furniture snaps to an 8 × 8 grid over the floor. One item per cell; no overlaps. */
export const HOUSE_GRID_SIZE = 8;
const GRID_MIN = 4;
const GRID_MAX = 96;
const GRID_CELL = (GRID_MAX - GRID_MIN) / HOUSE_GRID_SIZE;
/** One grid step in room percent (the width of one cell). */
export const HOUSE_GRID_STEP = GRID_CELL;

export function gridCellOf(x: number, y: number): { col: number; row: number } {
  const clamp = (value: number) =>
    Math.max(0, Math.min(HOUSE_GRID_SIZE - 1, Math.floor((value - GRID_MIN) / GRID_CELL)));
  return { col: clamp(x), row: clamp(y) };
}

/** Snaps a room percentage to the centre of its grid cell. */
export function snapToHouseGrid(x: number, y: number): [number, number] {
  const { col, row } = gridCellOf(x, y);
  return [GRID_MIN + GRID_CELL * (col + 0.5), GRID_MIN + GRID_CELL * (row + 0.5)];
}

/** True when another placement already occupies the grid cell at (x, y). */
export function isHouseGridCellOccupied(
  x: number,
  y: number,
  others: readonly { id: string; x?: number; y?: number }[],
  ignoreId?: string,
): boolean {
  const target = gridCellOf(x, y);
  return others.some((other) => {
    if (other.id === ignoreId || !Number.isFinite(other.x) || !Number.isFinite(other.y))
      return false;
    const cell = gridCellOf(other.x as number, other.y as number);
    return cell.col === target.col && cell.row === target.row;
  });
}

/** The centre of the first grid cell no item occupies, or null when the floor is full. */
export function firstFreeHouseGridCell(
  others: readonly { id: string; x?: number; y?: number }[],
): { x: number; y: number } | null {
  for (let row = 0; row < HOUSE_GRID_SIZE; row++) {
    for (let col = 0; col < HOUSE_GRID_SIZE; col++) {
      const x = GRID_MIN + GRID_CELL * (col + 0.5);
      const y = GRID_MIN + GRID_CELL * (row + 0.5);
      if (!isHouseGridCellOccupied(x, y, others)) return { x, y };
    }
  }
  return null;
}

/**
 * The slot a placement is drawn in. Moved furniture carries a free position
 * ("free:<id>") that matches no room slot, so it is drawn from its own coordinates
 * instead of being hidden.
 */
export function renderSlotForPlacement(
  placement: HousePlacement,
  slots: HouseSlot[],
): HouseSlot | undefined {
  const fixed = slots.find((slot) => slot.id === placement.slot);
  if (fixed) return fixed;
  if (!Number.isFinite(placement.x) || !Number.isFinite(placement.y)) return undefined;
  return {
    id: placement.slot,
    slot_type: placement.slot_type,
    x: placement.x as number,
    y: placement.y as number,
  };
}

export function roomCoordinatesToPercent(
  x: number,
  z: number,
  width: number,
  depth: number,
): [number, number] {
  const horizontalRange = Math.max(0.1, width - 0.8);
  const depthRange = Math.max(0.1, depth - 0.8);
  return [
    Math.max(4, Math.min(96, 50 + (x / horizontalRange) * 100)),
    Math.max(4, Math.min(96, 50 - (z / depthRange) * 100)),
  ];
}

export function roomPercentToPosition(
  x: number,
  y: number,
  width: number,
  depth: number,
): [number, number, number] {
  const horizontal = Math.max(4, Math.min(96, x));
  const vertical = Math.max(4, Math.min(96, y));
  return [(horizontal / 100 - 0.5) * (width - 0.8), 0.2, (0.5 - vertical / 100) * (depth - 0.8)];
}

export type HouseWallSegment = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
};

export function houseWallSegments(
  width: number,
  depth: number,
  wallHeight: number,
  doorwayWidth: number,
): HouseWallSegment[] {
  const wallThickness = 0.16;
  const frontWallHeight = wallHeight * 0.48;
  const doorHeight = wallHeight * 0.82;
  const rearDoorCenter = width * 0.22;
  const rearDoorLeft = rearDoorCenter - doorwayWidth / 2;
  const rearDoorRight = rearDoorCenter + doorwayWidth / 2;
  const rearLeftWidth = width / 2 + rearDoorLeft;
  const rearRightWidth = width / 2 - rearDoorRight;
  const sideFrontDepth = depth * 0.36;
  const sideBackDepth = depth - sideFrontDepth;
  const frontOpeningWidth = doorwayWidth * 1.4;
  const frontSideWidth = Math.max(0, (width - frontOpeningWidth) / 2);
  const rearY = wallHeight / 2;
  const frontY = frontWallHeight / 2;
  return [
    {
      id: "rear-left",
      position: [(-width / 2 + rearDoorLeft) / 2, rearY, -depth / 2],
      size: [rearLeftWidth, wallHeight, wallThickness],
    },
    {
      id: "rear-right",
      position: [(rearDoorRight + width / 2) / 2, rearY, -depth / 2],
      size: [rearRightWidth, wallHeight, wallThickness],
    },
    {
      id: "rear-door-lintel",
      position: [rearDoorCenter, doorHeight + (wallHeight - doorHeight) / 2, -depth / 2],
      size: [doorwayWidth, wallHeight - doorHeight, wallThickness],
    },
    {
      id: "left-back",
      position: [-width / 2, rearY, -sideFrontDepth / 2],
      size: [wallThickness, wallHeight, sideBackDepth],
    },
    {
      id: "left-cutaway",
      position: [-width / 2, frontY, sideBackDepth / 2],
      size: [wallThickness, frontWallHeight, sideFrontDepth],
    },
    {
      id: "right-back",
      position: [width / 2, rearY, -sideFrontDepth / 2],
      size: [wallThickness, wallHeight, sideBackDepth],
    },
    {
      id: "right-cutaway",
      position: [width / 2, frontY, sideBackDepth / 2],
      size: [wallThickness, frontWallHeight, sideFrontDepth],
    },
    {
      id: "front-left-cutaway",
      position: [-(frontOpeningWidth + frontSideWidth) / 2, frontY, depth / 2],
      size: [frontSideWidth, frontWallHeight, wallThickness],
    },
    {
      id: "front-right-cutaway",
      position: [(frontOpeningWidth + frontSideWidth) / 2, frontY, depth / 2],
      size: [frontSideWidth, frontWallHeight, wallThickness],
    },
  ];
}

export function housePartitionSegments(
  houseTypeId: string,
  width: number,
  depth: number,
): HouseWallSegment[] {
  if (!["studio-flat", "mini-flat", "bungalow", "duplex"].includes(houseTypeId)) return [];
  // Taller than the furniture, so it reads clearly from the camera, and centred front to back.
  const partitionHeight = 1.6;
  const partitionThickness = 0.14;
  const doorwayWidth = 1.25;
  const dividerZ = 0;
  const doorwayCenter = width * 0.05;
  const leftEnd = doorwayCenter - doorwayWidth / 2;
  const rightStart = doorwayCenter + doorwayWidth / 2;
  const segments: HouseWallSegment[] = [
    {
      id: "room-divider-left",
      position: [(-width / 2 + leftEnd) / 2, partitionHeight / 2, dividerZ],
      size: [width / 2 + leftEnd, partitionHeight, partitionThickness],
    },
    {
      id: "room-divider-right",
      position: [(rightStart + width / 2) / 2, partitionHeight / 2, dividerZ],
      size: [width / 2 - rightStart, partitionHeight, partitionThickness],
    },
  ];
  if (houseTypeId === "bungalow" || houseTypeId === "duplex") {
    const bathDividerX = -width * 0.28;
    const bathDoorWidth = 0.9;
    const bathDoorCenterZ = -depth * 0.31;
    const bathStartZ = -depth / 2;
    const bathEndZ = dividerZ;
    const bathDoorStart = bathDoorCenterZ - bathDoorWidth / 2;
    const bathDoorEnd = bathDoorCenterZ + bathDoorWidth / 2;
    segments.push(
      {
        id: "bath-divider-back",
        position: [bathDividerX, partitionHeight / 2, (bathStartZ + bathDoorStart) / 2],
        size: [partitionThickness, partitionHeight, bathDoorStart - bathStartZ],
      },
      {
        id: "bath-divider-front",
        position: [bathDividerX, partitionHeight / 2, (bathDoorEnd + bathEndZ) / 2],
        size: [partitionThickness, partitionHeight, bathEndZ - bathDoorEnd],
      },
    );
  }
  return segments;
}
