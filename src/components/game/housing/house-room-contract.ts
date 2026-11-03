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
  taskPose?: "sit" | "wash" | "cook" | "collect" | undefined;
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
};

export const HOUSE_ROOM_SIZE: Record<string, readonly [number, number]> = {
  "shared-room": [5.4, 4.4],
  "single-room": [6.2, 4.8],
  "studio-flat": [7.8, 5.8],
  "mini-flat": [9, 6.8],
  bungalow: [10.5, 7.8],
  duplex: [12, 8.8],
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
  const partitionHeight = 1.15;
  const partitionThickness = 0.12;
  const doorwayWidth = 1.25;
  const dividerZ = -depth * 0.12;
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
