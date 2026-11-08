import type { HousePlacement, HouseSlot } from "./HouseRoomScene";
import type { AvatarAnimationState, AvatarEquipment } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import type { FoodDelivery } from "@/lib/food-delivery-service";

/** A rectangle of the room, in room percent (see house-arrangement-guide). */
export type GuideZoneBounds = { x0: number; x1: number; y0: number; y1: number };

export type HouseRoomRendererProps = {
  houseTypeId: string;
  /** Room light switch. Off dims the room; omitted means on. */
  lightOn?: boolean;
  /** Floor being viewed: 0 ground, 1 upstairs (duplex only). */
  activeFloor?: 0 | 1;
  /** Tapping the stairs climbs or descends. */
  onUseStairs?: () => void;
  /** The entrance door is swung open. */
  doorOpen?: boolean;
  /** Highlighted area while an item is being placed: the guide's recommended zone. */
  guideZone?: GuideZoneBounds | null;
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

/** Wall art hangs on the back wall: the last grid row, centred on it. */
export const HOUSE_BACK_WALL_Y = GRID_MIN + GRID_CELL * (HOUSE_GRID_SIZE - 0.5);

/** True for wall art pieces (art keys start with "wall-art"). */
export function isWallArtKind(artKey: string | null | undefined): boolean {
  return typeof artKey === "string" && artKey.startsWith("wall-art");
}

/** Keeps wall art on the back wall: the x is snapped to a column, the y is fixed. */
export function snapToBackWall(x: number): [number, number] {
  const { col } = gridCellOf(x, HOUSE_BACK_WALL_Y);
  return [GRID_MIN + GRID_CELL * (col + 0.5), HOUSE_BACK_WALL_Y];
}

/** First free column on the back wall, or null when the wall is full. */
export function firstFreeBackWallCell(
  others: readonly { id: string; x?: number; y?: number }[],
): { x: number; y: number } | null {
  for (let col = 0; col < HOUSE_GRID_SIZE; col++) {
    const x = GRID_MIN + GRID_CELL * (col + 0.5);
    if (!isHouseGridCellOccupied(x, HOUSE_BACK_WALL_Y, others)) return { x, y: HOUSE_BACK_WALL_Y };
  }
  return null;
}

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

/** Point just inside the entrance door, where the character stands to go out or comes in. */
export function houseDoorThreshold(
  houseTypeId: string,
  width: number,
  depth: number,
): [number, number, number] {
  return [houseRearDoorCenter(houseTypeId, width), 0.06, -depth / 2 + 0.6];
}

/** Centre of the entrance door on the back wall. In four-room homes it opens into the sitting room. */
export function houseRearDoorCenter(houseTypeId: string, width: number): number {
  return FOUR_ROOM_HOME_TYPES.includes(houseTypeId) ? -width * 0.25 : width * 0.22;
}

export function houseWallSegments(
  width: number,
  depth: number,
  wallHeight: number,
  doorwayWidth: number,
  rearDoorCenter: number = width * 0.22,
  closedFront = false,
): HouseWallSegment[] {
  const wallThickness = 0.22;
  const frontWallHeight = closedFront ? wallHeight : wallHeight * 0.48;
  const doorHeight = wallHeight * 0.82;
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
  const front: HouseWallSegment[] = closedFront
    ? [
        {
          id: "front-wall",
          position: [0, frontY, depth / 2],
          size: [width, frontWallHeight, wallThickness],
        },
      ]
    : [
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
    ...front,
  ];
}

/**
 * Studio layout, four rooms with an empty doorway into each:
 * sitting room (back-left), bedroom (front-left), kitchen and dining (back-right),
 * bathroom (front-right). Walls are centred on the room, so the origin is the middle.
 */
function studioPartitionSegments(width: number, depth: number, height: number): HouseWallSegment[] {
  const thickness = 0.22;
  const doorway = 1.1;
  const alongX = (id: string, z: number, x0: number, x1: number): HouseWallSegment => ({
    id,
    position: [(x0 + x1) / 2, height / 2, z],
    size: [x1 - x0, height, thickness],
  });
  const alongZ = (id: string, x: number, z0: number, z1: number): HouseWallSegment => ({
    id,
    position: [x, height / 2, (z0 + z1) / 2],
    size: [thickness, height, z1 - z0],
  });
  const sittingDoorX = -width * 0.25;
  const bathDoorZ = depth * 0.25;
  const kitchenDoorZ = -depth * 0.25;
  return [
    // Sitting room and bedroom, with a doorway at x = sittingDoorX.
    alongX("sitting-bedroom-left", 0, -width / 2, sittingDoorX - doorway / 2),
    alongX("sitting-bedroom-right", 0, sittingDoorX + doorway / 2, 0),
    // Sitting room and kitchen, with a doorway at z = kitchenDoorZ.
    alongZ("sitting-kitchen-back", 0, -depth / 2, kitchenDoorZ - doorway / 2),
    alongZ("sitting-kitchen-front", 0, kitchenDoorZ + doorway / 2, 0),
    // Kitchen and bathroom, a solid wall.
    alongX("kitchen-bath", 0, 0, width / 2),
    // Bedroom and bathroom, with a doorway at z = bathDoorZ.
    alongZ("bedroom-bath-back", 0, 0, bathDoorZ - doorway / 2),
    alongZ("bedroom-bath-front", 0, bathDoorZ + doorway / 2, depth / 2),
  ];
}

/** Home types that have the four-room plan: sitting room, bedroom, kitchen and dining, bathroom. */
export const FOUR_ROOM_HOME_TYPES: readonly string[] = [
  "studio-flat",
  "mini-flat",
  "bungalow",
  "duplex",
];

export function housePartitionSegments(
  houseTypeId: string,
  width: number,
  depth: number,
): HouseWallSegment[] {
  if (!FOUR_ROOM_HOME_TYPES.includes(houseTypeId)) return [];
  // Taller than the furniture, so it reads clearly from the camera.
  return studioPartitionSegments(width, depth, 1.9);
}

/** Stairs in a two-storey home. The same footprint serves both floors, against the left wall. */
export type HouseStairs = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Ground-floor point just outside the front of the stairs. */
  bottom: [number, number];
  /** Upstairs point just outside the back of the stairs. */
  top: [number, number];
};

export function houseStairs(houseTypeId: string, width: number, depth: number): HouseStairs | null {
  if (houseTypeId !== "duplex") return null;
  const x0 = -width / 2 + 0.1;
  const x1 = -width / 2 + 1.1;
  const z0 = -depth * 0.45;
  const z1 = -depth * 0.1;
  const cx = (x0 + x1) / 2;
  return { x0, x1, z0, z1, bottom: [cx, z1 + 0.35], top: [cx, z0 - 0.35] };
}

/**
 * Upstairs walls for a duplex: a lounge with a mini gym (left, with the stairs), a living room
 * (back-right) and a bedroom (front-right). Each has an empty doorway.
 */
export function upstairsPartitionSegments(width: number, depth: number): HouseWallSegment[] {
  const height = 1.9;
  const thickness = 0.22;
  const doorway = 1.1;
  const alongX = (id: string, z: number, x0: number, x1: number): HouseWallSegment => ({
    id,
    position: [(x0 + x1) / 2, height / 2, z],
    size: [x1 - x0, height, thickness],
  });
  const alongZ = (id: string, x: number, z0: number, z1: number): HouseWallSegment => ({
    id,
    position: [x, height / 2, (z0 + z1) / 2],
    size: [thickness, height, z1 - z0],
  });
  const livingDoorZ = -depth * 0.25;
  const bedroomDoorX = width * 0.25;
  return [
    // Lounge and living room, with a doorway at z = livingDoorZ.
    alongZ("upstairs-lounge-living-back", 0, -depth / 2, livingDoorZ - doorway / 2),
    alongZ("upstairs-lounge-living-front", 0, livingDoorZ + doorway / 2, depth / 2),
    // Living room and bedroom, with a doorway at x = bedroomDoorX.
    alongX("upstairs-living-bedroom-left", 0, 0, bedroomDoorX - doorway / 2),
    alongX("upstairs-living-bedroom-right", 0, bedroomDoorX + doorway / 2, width / 2),
  ];
}

/** Partition segments for the floor being viewed. Single-storey layouts have one floor. */
export function housePartitionSegmentsForFloor(
  houseTypeId: string,
  width: number,
  depth: number,
  floor: 0 | 1,
): HouseWallSegment[] {
  if (floor === 1) return houseTypeId === "duplex" ? upstairsPartitionSegments(width, depth) : [];
  return housePartitionSegments(houseTypeId, width, depth);
}
