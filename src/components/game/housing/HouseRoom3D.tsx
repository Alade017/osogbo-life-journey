import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import { Plane, Vector3 } from "three";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import type { FoodDelivery } from "@/lib/food-delivery-service";
import { homeFurnitureAction } from "@/lib/home-furniture-actions";
import type { HousePlacement, HouseSlot } from "./HouseRoomScene";
import {
  HOUSE_ROOM_SIZE as ROOM_SIZE,
  housePartitionSegments,
  interpolateRoomPosition,
  roomCoordinatesToPercent,
  isHouseGridCellOccupied,
  renderSlotForPlacement,
  roomPercentToPosition,
  snapToHouseGrid,
  houseSlotPosition as slotPosition,
  houseWallSegments,
  type HouseRoomRendererProps as Props,
} from "./house-room-contract";

import {
  WorldCamera,
  WorldInstances,
  WorldLighting,
  WorldMaterial,
  type WorldInstance,
} from "@/components/3d/WorldScene";
import { WORLD_SCALE } from "@/components/3d/world-theme";

type WaitingCourier = { delivery: FoodDelivery; index: number };

// Keep drei's independent HTML roots outside React's canvas DOM children.
const RoomOverlayContext = createContext<RefObject<HTMLElement>>({ current: null! });

type DragPreview = { placementId: string; x: number; z: number };
type DragPointer = {
  placement: HousePlacement;
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
};
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), -0.2);

function hasRoomPosition(
  placement: HousePlacement,
): placement is HousePlacement & { x: number; y: number } {
  return Number.isFinite(placement.x) && Number.isFinite(placement.y);
}

type FloorTone =
  "tileLight" | "tileShade" | "tileBath" | "tileBathShade" | "tileDark" | "tileDarkShade";

function RoomFloor({
  houseTypeId,
  width,
  depth,
}: {
  houseTypeId: string;
  width: number;
  depth: number;
}) {
  const groups = useMemo(() => {
    const tiles: Record<FloorTone, WorldInstance[]> = {
      tileLight: [],
      tileShade: [],
      tileBath: [],
      tileBathShade: [],
      tileDark: [],
      tileDarkShade: [],
    };
    const tileSize = 0.78;
    const hasPrivateRooms = ["studio-flat", "mini-flat", "bungalow", "duplex"].includes(
      houseTypeId,
    );
    const hasBathroomZone = houseTypeId === "bungalow" || houseTypeId === "duplex";
    let row = 0;
    for (let z0 = -depth / 2; z0 < depth / 2; z0 += tileSize, row += 1) {
      const tileDepth = Math.min(tileSize, depth / 2 - z0);
      let column = 0;
      for (let x0 = -width / 2; x0 < width / 2; x0 += tileSize, column += 1) {
        const tileWidth = Math.min(tileSize, width / 2 - x0);
        const x = x0 + tileWidth / 2;
        const z = z0 + tileDepth / 2;
        const alternate = (row + column) % 2 === 0;
        const tone: FloorTone =
          hasBathroomZone && x < -width * 0.28 && z < -depth * 0.12
            ? alternate
              ? "tileBath"
              : "tileBathShade"
            : hasPrivateRooms && x > width * 0.02 && z < -depth * 0.12
              ? alternate
                ? "tileDark"
                : "tileDarkShade"
              : alternate
                ? "tileLight"
                : "tileShade";
        tiles[tone].push({
          position: [x, 0.02, z],
          scale: [tileWidth, 0.035, tileDepth],
        });
      }
    }
    return tiles;
  }, [depth, houseTypeId, width]);

  return (
    <>
      {(Object.entries(groups) as [FloorTone, WorldInstance[]][]).map(([tone, items]) => (
        <WorldInstances key={tone} items={items} tone={tone} />
      ))}
    </>
  );
}

function OsogboRoomPrototype({
  houseTypeId,
  width,
  depth,
  editMode,
}: {
  houseTypeId: string;
  width: number;
  depth: number;
  editMode: boolean;
}) {
  const height = WORLD_SCALE.door * 1.15;
  const doorwayWidth = 1.12;
  const doorHeight = WORLD_SCALE.door * 1.1;
  const rearDoorCenter = width * 0.22;
  return (
    <group>
      <mesh receiveShadow position={[0, -0.26, 0]}>
        <cylinderGeometry
          args={[Math.max(width, depth) * 0.8, Math.max(width, depth) * 0.8, 0.15, 48]}
        />
        <WorldMaterial tone="foliage" />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[width, 0.2, depth]} />
        <WorldMaterial tone="ground" />
      </mesh>
      <group name="house-cutaway-walls" scale={[1, editMode ? 0.28 : 1, 1]}>
        {houseWallSegments(width, depth, height, doorwayWidth).map((segment) => (
          <group key={segment.id}>
            <mesh castShadow receiveShadow position={segment.position}>
              <boxGeometry args={segment.size} />
              <WorldMaterial tone="partition" />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[
                segment.position[0],
                segment.position[1] + segment.size[1] / 2,
                segment.position[2],
              ]}
            >
              <boxGeometry args={[segment.size[0] + 0.05, 0.065, segment.size[2] + 0.05]} />
              <WorldMaterial tone="trim" />
            </mesh>
          </group>
        ))}
        <mesh
          castShadow
          receiveShadow
          position={[rearDoorCenter, doorHeight / 2, -depth / 2 + 0.06]}
        >
          <boxGeometry args={[doorwayWidth * 0.92, doorHeight, 0.075]} />
          <WorldMaterial tone="door" />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          position={[rearDoorCenter, doorHeight / 2, -depth / 2 + 0.105]}
        >
          <boxGeometry args={[doorwayWidth * 0.68, doorHeight * 0.78, 0.025]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh
          castShadow
          position={[rearDoorCenter + doorwayWidth * 0.29, doorHeight * 0.52, -depth / 2 + 0.13]}
        >
          <sphereGeometry args={[0.045, 8, 6]} />
          <WorldMaterial tone="trim" />
        </mesh>
        <group position={[-width * 0.28, height * 0.57, -depth / 2 + 0.12]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.62, 0.94, 0.12]} />
            <WorldMaterial tone="trim" />
          </mesh>
          <mesh position={[0, 0, 0.075]}>
            <boxGeometry args={[1.46, 0.76, 0.035]} />
            <WorldMaterial tone="glass" />
          </mesh>
          {[-0.22, 0, 0.22].map((y) => (
            <mesh key={y} position={[0, y, 0.1]}>
              <boxGeometry args={[1.47, 0.045, 0.035]} />
              <WorldMaterial tone="trim" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.105]}>
            <boxGeometry args={[0.055, 0.76, 0.035]} />
            <WorldMaterial tone="trim" />
          </mesh>
        </group>
        {housePartitionSegments(houseTypeId, width, depth).map((segment) => (
          <group key={segment.id}>
            <mesh castShadow receiveShadow position={segment.position}>
              <boxGeometry args={segment.size} />
              <WorldMaterial tone="partition" />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[
                segment.position[0],
                segment.position[1] + segment.size[1] / 2,
                segment.position[2],
              ]}
            >
              <boxGeometry args={[segment.size[0] + 0.04, 0.055, segment.size[2] + 0.04]} />
              <WorldMaterial tone="trim" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Walk-in shower: tiled wall, raised tray, glass screen, chrome riser and rain head. Spray shows on hover. */
function ShowerUnit({ hovered }: { hovered: boolean }) {
  return (
    <group>
      {/* Tiled back wall */}
      <mesh castShadow receiveShadow position={[0, 1.05, -0.36]}>
        <boxGeometry args={[0.9, 2.1, 0.04]} />
        <WorldMaterial tone="linen" />
      </mesh>
      {/* Raised tray */}
      <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.9, 0.1, 0.72]} />
        <WorldMaterial tone="linen" />
      </mesh>
      {/* Drain */}
      <mesh position={[0, 0.102, 0.05]}>
        <cylinderGeometry args={[0.06, 0.06, 0.012, 14]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Glass side screen and frame */}
      <mesh position={[0.44, 1.05, 0]}>
        <boxGeometry args={[0.03, 2.0, 0.72]} />
        <meshPhysicalMaterial color="#bfe6f2" transparent opacity={0.3} roughness={0.05} />
      </mesh>
      <mesh position={[0.44, 2.07, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.72]} />
        <WorldMaterial tone="trim" />
      </mesh>
      {/* Glass sliding door on the open side */}
      <mesh position={[0.22, 0.95, 0.34]}>
        <boxGeometry args={[0.42, 1.7, 0.02]} />
        <meshPhysicalMaterial color="#bfe6f2" transparent opacity={0.3} roughness={0.05} />
      </mesh>
      {/* Wall riser, arm and rain head */}
      <mesh castShadow position={[-0.3, 1.05, -0.32]}>
        <cylinderGeometry args={[0.018, 0.018, 1.7, 10]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[-0.3, 1.95, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.28, 10]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[-0.3, 1.9, -0.08]}>
        <cylinderGeometry args={[0.07, 0.05, 0.03, 20]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Wall valve */}
      <mesh castShadow position={[-0.3, 1.0, -0.31]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[-0.3, 1.0, -0.34]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Spray streaks, only while hovered */}
      {hovered &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={`spray-${i}`}
              position={[-0.3 + Math.cos(angle) * 0.05, 1.5, -0.08 + Math.sin(angle) * 0.05]}
            >
              <cylinderGeometry args={[0.006, 0.004, 0.7, 6]} />
              <meshPhysicalMaterial color="#8fd3ff" transparent opacity={0.6} />
            </mesh>
          );
        })}
    </group>
  );
}

/** Furniture palette, matched to the reference: cream upholstery, warm timber, dark screen. */
const FURNITURE_COLOURS = {
  sofaFrame: "#e2d3ae",
  sofaCushion: "#f1e7cf",
  mediaWood: "#8a5a36",
  mediaCubby: "#2a1d14",
  screenBezel: "#5b6068",
  screen: "#2d3138",
  bedLinen: "#f6efe0",
  bedPillow: "#fbf6ea",
  blanket: "#c9825b",
  wardrobeDoor: "#9b6a42",
  brass: "#d8b56a",
} as const;

export function FurnitureFallback({
  artKey,
  slotType,
  hovered = false,
}: {
  artKey: string | undefined;
  slotType: string;
  hovered?: boolean;
}) {
  const rawKind = artKey ?? slotType;
  const kind =
    rawKind === "starter-bed"
      ? "bed"
      : rawKind === "starter-seat"
        ? "sofa"
        : rawKind === "starter-light"
          ? "light"
          : rawKind;
  if (kind === "bed")
    return (
      <group scale={[1.2, 1, 1.45]}>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.95, 0.18, 1.35]}
          radius={0.05}
          smoothness={4}
          position={[0, 0.14, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.98, 0.62, 0.12]}
          radius={0.07}
          smoothness={4}
          position={[0, 0.48, -0.66]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.88, 0.14, 1.22]}
          radius={0.05}
          smoothness={4}
          position={[0, 0.28, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.bedLinen} roughness={0.95} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.9, 0.05, 0.8]}
          radius={0.03}
          smoothness={4}
          position={[0, 0.37, 0.2]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.blanket} roughness={0.95} />
        </RoundedBox>
        {[-0.23, 0.23].map((x) => (
          <RoundedBox
            castShadow
            receiveShadow
            key={`bed-pillow-${x}`}
            args={[0.36, 0.09, 0.25]}
            radius={0.04}
            smoothness={4}
            position={[x, 0.37, -0.4]}
          >
            <meshStandardMaterial color={FURNITURE_COLOURS.bedPillow} roughness={0.95} />
          </RoundedBox>
        ))}
      </group>
    );
  if (["sofa", "sofa-2", "seat"].includes(kind))
    return (
      <group>
        <RoundedBox
          castShadow
          receiveShadow
          args={[1.2, 0.3, 0.62]}
          radius={0.09}
          smoothness={4}
          position={[0, 0.2, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.sofaFrame} roughness={0.85} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[1.2, 0.5, 0.18]}
          radius={0.08}
          smoothness={4}
          position={[0, 0.5, -0.24]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.sofaFrame} roughness={0.85} />
        </RoundedBox>
        {[-0.6, 0.6].map((x) => (
          <RoundedBox
            castShadow
            receiveShadow
            key={`sofa-arm-${x}`}
            args={[0.18, 0.38, 0.62]}
            radius={0.08}
            smoothness={4}
            position={[x, 0.42, 0]}
          >
            <meshStandardMaterial color={FURNITURE_COLOURS.sofaFrame} roughness={0.85} />
          </RoundedBox>
        ))}
        {[-0.3, 0.3].map((x) => (
          <RoundedBox
            castShadow
            receiveShadow
            key={`sofa-seat-${x}`}
            args={[0.56, 0.12, 0.44]}
            radius={0.05}
            smoothness={4}
            position={[x, 0.4, 0.06]}
          >
            <meshStandardMaterial color={FURNITURE_COLOURS.sofaCushion} roughness={0.9} />
          </RoundedBox>
        ))}
        {[-0.3, 0.3].map((x) => (
          <RoundedBox
            castShadow
            receiveShadow
            key={`sofa-back-${x}`}
            args={[0.56, 0.36, 0.14]}
            radius={0.06}
            smoothness={4}
            position={[x, 0.58, -0.17]}
          >
            <meshStandardMaterial color={FURNITURE_COLOURS.sofaCushion} roughness={0.9} />
          </RoundedBox>
        ))}
      </group>
    );
  if (kind === "television" || kind === "computer")
    return (
      <group>
        <RoundedBox
          castShadow
          receiveShadow
          args={[kind === "computer" ? 0.9 : 1.0, 0.26, 0.36]}
          radius={0.04}
          smoothness={4}
          position={[0, 0.16, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        {[-0.3, 0, 0.3].map((x) => (
          <mesh key={`tv-cubby-${x}`} position={[x, 0.16, 0.181]}>
            <boxGeometry args={[0.2, 0.14, 0.01]} />
            <meshStandardMaterial color={FURNITURE_COLOURS.mediaCubby} />
          </mesh>
        ))}
        <RoundedBox
          castShadow
          receiveShadow
          args={[kind === "computer" ? 0.62 : 0.9, 0.52, 0.06]}
          radius={0.03}
          smoothness={4}
          position={[0, 0.56, -0.08]}
        >
          <meshStandardMaterial
            color={FURNITURE_COLOURS.screenBezel}
            roughness={0.4}
            metalness={0.2}
          />
        </RoundedBox>
        <mesh position={[0, 0.56, -0.04]}>
          <planeGeometry args={[kind === "computer" ? 0.56 : 0.82, 0.46]} />
          <meshStandardMaterial color={FURNITURE_COLOURS.screen} roughness={0.2} metalness={0.3} />
        </mesh>
      </group>
    );
  if (kind === "stove")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
          <boxGeometry args={[0.72, 0.64, 0.56]} />
          <WorldMaterial tone="wall" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.34, 0.29]}>
          <boxGeometry args={[0.51, 0.32, 0.02]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh
            castShadow
            receiveShadow
            key={x}
            position={[x, 0.65, -0.08]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.11, 0.02, 4, 12]} />
            <WorldMaterial tone="timber" />
          </mesh>
        ))}
        <group position={[0, 0.72, -0.08]}>
          <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.21, 0.17, 0.3, 12]} />
            <WorldMaterial tone="timber" />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.045, 12]} />
            <WorldMaterial tone="timber" />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.055, 8, 6]} />
            <WorldMaterial tone="clay" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              castShadow
              receiveShadow
              key={`pot-handle-${side}`}
              position={[side * 0.22, 0.22, 0]}
            >
              <torusGeometry args={[0.055, 0.018, 5, 10]} />
              <WorldMaterial tone="timber" />
            </mesh>
          ))}
        </group>
      </group>
    );
  if (kind === "pot" || kind === "cooking-pot")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.29, 0.22, 0.4, 12]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.43, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 12]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <WorldMaterial tone="clay" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            castShadow
            receiveShadow
            key={`pot-handle-${side}`}
            position={[side * 0.29, 0.27, 0]}
          >
            <torusGeometry args={[0.07, 0.02, 5, 10]} />
            <WorldMaterial tone="timber" />
          </mesh>
        ))}
      </group>
    );
  if (kind === "toilet")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.2, 0.1]}>
          <cylinderGeometry args={[0.26, 0.2, 0.4, 12]} />
          <WorldMaterial tone="linen" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.47, -0.18]}>
          <boxGeometry args={[0.52, 0.45, 0.2]} />
          <WorldMaterial tone="linen" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.42, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.045, 6, 16]} />
          <WorldMaterial tone="linen" />
        </mesh>
      </group>
    );
  if (kind === "shower") return <ShowerUnit hovered={hovered} />;
  if (kind === "plant")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.11, 0.085, 0.16, 10]} />
          <WorldMaterial tone="clay" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.07, 0.31, 0.015]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <WorldMaterial tone="slate" />
        </mesh>
      </group>
    );
  if (kind === "light")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 12]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.15, 8]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 1.24, 0]}>
          <coneGeometry args={[0.32, 0.4, 12, 1, true]} />
          <WorldMaterial tone="ground" />
        </mesh>
      </group>
    );
  if (kind === "wardrobe")
    return (
      <group>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.92, 1.4, 0.48]}
          radius={0.04}
          smoothness={4}
          position={[0, 0.7, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.96, 0.06, 0.5]}
          radius={0.025}
          smoothness={4}
          position={[0, 1.43, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.86, 0.08, 0.44]}
          radius={0.03}
          smoothness={4}
          position={[0, 0.04, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaCubby} roughness={0.9} />
        </RoundedBox>
        {[-0.22, 0.22].map((x) => (
          <RoundedBox
            castShadow
            receiveShadow
            key={`wardrobe-door-${x}`}
            args={[0.42, 1.18, 0.03]}
            radius={0.025}
            smoothness={4}
            position={[x, 0.7, 0.25]}
          >
            <meshStandardMaterial color={FURNITURE_COLOURS.wardrobeDoor} roughness={0.6} />
          </RoundedBox>
        ))}
        {[-0.045, 0.045].map((x) => (
          <mesh castShadow receiveShadow key={`wardrobe-handle-${x}`} position={[x, 0.74, 0.28]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial
              color={FURNITURE_COLOURS.brass}
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>
    );
  if (kind === "coffee-table")
    return (
      <group>
        <RoundedBox
          castShadow
          receiveShadow
          args={[1.05, 0.1, 0.65]}
          radius={0.04}
          smoothness={4}
          position={[0, 0.43, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.9, 0.04, 0.52]}
          radius={0.015}
          smoothness={4}
          position={[0, 0.16, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        {[-0.42, 0.42].flatMap((x) =>
          [-0.23, 0.23].map((z) => (
            <mesh castShadow receiveShadow key={`${x}-${z}`} position={[x, 0.22, z]}>
              <cylinderGeometry args={[0.04, 0.04, 0.4, 10]} />
              <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
            </mesh>
          )),
        )}
      </group>
    );
  if (kind === "wall-art")
    return (
      <group>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.76, 0.62, 0.05]}
          radius={0.05}
          smoothness={4}
          position={[0, 0.7, 0]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.mediaWood} roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.64, 0.5, 0.02]}
          radius={0.02}
          smoothness={4}
          position={[0, 0.7, 0.035]}
        >
          <meshStandardMaterial color={FURNITURE_COLOURS.bedLinen} roughness={0.95} />
        </RoundedBox>
        <mesh castShadow receiveShadow position={[0, 0.72, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.02, 20]} />
          <meshStandardMaterial color={FURNITURE_COLOURS.blanket} roughness={0.9} />
        </mesh>
      </group>
    );
  return (
    <mesh castShadow receiveShadow position={[0, 0.28, 0]}>
      <boxGeometry args={[0.62, 0.56, 0.52]} />
      <WorldMaterial tone="clay" />
    </mesh>
  );
}

function RoomCharacter({
  name,
  appearance,
  gender,
  equipment,
  animationState,
  activityRequestId,
  activityLabel,
  position,
  bedPosition,
}: {
  name: string;
  appearance: NonNullable<Props["appearance"]>;
  gender: string;
  equipment: NonNullable<Props["equipment"]>;
  animationState: NonNullable<Props["animationState"]>;
  activityRequestId: Props["activityRequestId"];
  activityLabel: string | null;
  position: [number, number, number];
  bedPosition: [number, number, number] | null;
}) {
  const overlayPortal = useContext(RoomOverlayContext);
  const [displayPosition, setDisplayPosition] = useState(position);
  const [walkingToBed, setWalkingToBed] = useState(false);
  const wasSleeping = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const visibleAnimation = walkingToBed ? "walk" : animationState;
  const [startX, startY, startZ] = position;
  const hasBedPosition = bedPosition !== null;
  const targetX = bedPosition?.[0] ?? 0;
  const targetY = bedPosition?.[1] ?? 0;
  const targetZ = bedPosition?.[2] ?? 0;
  const walkingFacing: "west" | "east" | "north" | "south" = bedPosition
    ? Math.abs(bedPosition[0] - position[0]) > Math.abs(bedPosition[2] - position[2])
      ? bedPosition[0] < position[0]
        ? "west"
        : "east"
      : bedPosition[2] < position[2]
        ? "north"
        : "south"
    : "south";

  useEffect(() => {
    const start: [number, number, number] = [startX, startY, startZ];
    const target: [number, number, number] = [targetX, targetY, targetZ];
    if (animationState !== "sleep" || !hasBedPosition) {
      setWalkingToBed(false);
      setDisplayPosition(wasSleeping.current && hasBedPosition ? target : start);
      wasSleeping.current = false;
      return;
    }

    const startPosition = wasSleeping.current ? target : start;
    wasSleeping.current = true;
    if (reducedMotion) {
      setWalkingToBed(false);
      setDisplayPosition(target);
      return;
    }

    const startedAt = performance.now();
    const duration = 950;
    let frameId = 0;
    setDisplayPosition(startPosition);
    setWalkingToBed(true);

    const walk = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setDisplayPosition(interpolateRoomPosition(startPosition, target, progress));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(walk);
      } else {
        setWalkingToBed(false);
      }
    };

    frameId = window.requestAnimationFrame(walk);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activityRequestId,
    animationState,
    hasBedPosition,
    reducedMotion,
    startX,
    startY,
    startZ,
    targetX,
    targetY,
    targetZ,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return (
    <>
      <WorldCharacter
        name={name}
        appearance={appearance}
        gender={gender}
        equipment={equipment}
        position={displayPosition}
        animation={visibleAnimation}
        facing={walkingToBed ? walkingFacing : "south"}
      />
      {activityLabel && (
        <Html
          portal={overlayPortal}
          zIndexRange={[8, 0]}
          center
          position={[displayPosition[0], displayPosition[1] + 2.1, displayPosition[2]]}
          style={{ pointerEvents: "none" }}
        >
          <span className="house-room-character-activity">{activityLabel}</span>
        </Html>
      )}
    </>
  );
}

/** Walks the courier out of the room after the player has collected the package. */
function DepartingCourier({
  startX,
  startZ,
  exitX,
  exitZ,
  onGone,
}: {
  startX: number;
  startZ: number;
  exitX: number;
  exitZ: number;
  onGone: () => void;
}) {
  const [position, setPosition] = useState<[number, number, number]>([startX, 0.06, startZ]);
  const goneRef = useRef(onGone);
  goneRef.current = onGone;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : 2400;
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      setPosition([
        startX + (exitX - startX) * progress,
        0.06,
        startZ + (exitZ - startZ) * progress,
      ]);
      if (progress < 1) frame = window.requestAnimationFrame(step);
      else goneRef.current();
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [startX, startZ, exitX, exitZ]);

  return (
    <WorldCharacter
      name="Food courier"
      gender="male"
      appearance={COURIER_LOOK}
      position={position}
      animation="walk"
      facing="north"
    />
  );
}

const COURIER_LOOK = { outfit: 1, bottoms: 1, shoes: 0 } as const;

function FoodCourier({
  delivery,
  width,
  depth,
  index,
  onCollect,
}: {
  delivery: FoodDelivery;
  width: number;
  depth: number;
  index: number;
  onCollect?: ((id: string) => void) | undefined;
}) {
  const overlayPortal = useContext(RoomOverlayContext);
  const doorX = width * 0.22;
  const doorZ = -depth / 2 + 0.2;
  const inside = delivery.deliveryChoice === "inside";
  // Where the courier stands once he has arrived (one spot per waiting package).
  const standX = (inside ? width * 0.13 : doorX) + index * 0.5;
  const standZ = inside ? -depth / 2 + 1.35 : doorZ;
  const knocking = delivery.deliveryState === "awaiting_response";
  const approaching = delivery.deliveryState === "approaching";
  const waiting = delivery.deliveryState === "package_waiting";
  const [position, setPosition] = useState<[number, number, number]>(
    approaching ? [doorX, 0.06, doorZ] : [standX, 0.06, standZ],
  );

  useEffect(() => {
    if (!approaching) {
      setPosition([standX, 0.06, standZ]);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPosition([standX, 0.06, standZ]);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1800);
      setPosition([doorX + (standX - doorX) * progress, 0.06, doorZ + (standZ - doorZ) * progress]);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    setPosition([doorX, 0.06, doorZ]);
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [approaching, doorX, doorZ, standX, standZ]);

  // Behind the door: only the knock is shown. No face, no body, no package.
  if (knocking) {
    return (
      <Html
        portal={overlayPortal}
        zIndexRange={[8, 0]}
        center
        position={[doorX, 1.7, doorZ]}
        style={{ pointerEvents: "none" }}
      >
        <span className="house-courier-knock">Knock knock</span>
      </Html>
    );
  }

  return (
    <>
      <WorldCharacter
        name="Food courier"
        gender="male"
        position={position}
        appearance={COURIER_LOOK}
        animation={approaching && inside ? "walk" : waiting ? "talk" : "idle"}
        facing="south"
      />
      {/* Package held in the courier's hand (offset is an estimate, tune if needed) */}
      <FoodPackage
        delivery={delivery}
        position={[position[0] + 0.2, 0.9, position[2] + 0.2]}
        onCollect={waiting ? onCollect : undefined}
      />
      {waiting && onCollect && (
        <Html
          portal={overlayPortal}
          zIndexRange={[8, 0]}
          center
          position={[position[0] + 0.2, 1.25, position[2] + 0.2]}
          style={{ pointerEvents: "none" }}
        >
          <span className="house-food-package-label">Tap package to collect</span>
        </Html>
      )}
    </>
  );
}

const VENDOR_BAG_COLOURS = ["#e4572e", "#2f7d4f", "#1f5fa8", "#f2a541", "#7b3f9e"] as const;
const NON_FOOD_WORDS =
  /\b(plate|spoon|fork|knife|cup|bowl|utensil|phone|charger|shoe|slipper|shirt|cloth|fabric|soap|detergent|tissue|towel|lamp|bulb|tool|bag)\b/i;

/** Picks a stable colour for each vendor, so the same vendor always uses the same nylon. */
function vendorColour(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return VENDOR_BAG_COLOURS[hash % VENDOR_BAG_COLOURS.length]!;
}

/** A delivery is food only if none of its items is a utensil or accessory. */
function isFoodDelivery(items: FoodDelivery["items"]) {
  return items.every((item) => !NON_FOOD_WORDS.test(item.name));
}

/** Food: a vendor-coloured nylon bag, tied at the neck, with food trays inside. */
function FoodNylon({ colour }: { colour: string }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[1, 1.1, 0.55]} castShadow>
        <sphereGeometry args={[0.26, 24, 16]} />
        <meshPhysicalMaterial
          color={colour}
          transparent
          opacity={0.82}
          roughness={0.25}
          clearcoat={0.5}
        />
      </mesh>
      {/* Printed vendor band on the front */}
      <mesh position={[0, 0.2, 0.146]}>
        <boxGeometry args={[0.36, 0.1, 0.01]} />
        <meshStandardMaterial color="#fbfaf6" roughness={0.5} />
      </mesh>
      {/* Tied neck and handle */}
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.06, 12]} />
        <meshStandardMaterial color={colour} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <torusGeometry args={[0.1, 0.012, 8, 20, Math.PI]} />
        <meshStandardMaterial color={colour} roughness={0.3} />
      </mesh>
      {/* Food trays with foil lids, inside the bag */}
      <mesh position={[-0.05, 0.14, 0]} castShadow>
        <boxGeometry args={[0.2, 0.07, 0.15]} />
        <meshStandardMaterial color="#e9e5d8" roughness={0.7} />
      </mesh>
      <mesh position={[-0.05, 0.185, 0]}>
        <boxGeometry args={[0.18, 0.012, 0.13]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.08, 0.15, 0.03]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.16, 0.07, 0.13]} />
        <meshStandardMaterial color="#e9e5d8" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Non-food: a plain kraft parcel with a taped cross, no nylon and no trays. */
function NonFoodParcel() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.13, 0]}>
        <boxGeometry args={[0.42, 0.22, 0.34]} />
        <meshStandardMaterial color="#a9825a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.07, 0.006, 0.35]} />
        <meshStandardMaterial color="#e2cf9a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.43, 0.006, 0.07]} />
        <meshStandardMaterial color="#e2cf9a" roughness={0.6} />
      </mesh>
    </group>
  );
}

function FoodPackage({
  onCollect,
  delivery,
  position,
}: {
  delivery: FoodDelivery;
  onCollect?: ((id: string) => void) | undefined;
  position: [number, number, number];
}) {
  const food = isFoodDelivery(delivery.items);
  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta <= 4) onCollect?.(delivery.id);
      }}
    >
      {food ? <FoodNylon colour={vendorColour(delivery.vendorName)} /> : <NonFoodParcel />}
    </group>
  );
}

function SlotObject({
  slot,
  placement,
  width,
  depth,
  editMode,
  moveEnabled,
  inputBlocked,
  dragPreview,
  activeSlotType,
  onSelectPlacement,
  onSelectSlot,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  suppressClick,
}: {
  slot: HouseSlot;
  placement: HousePlacement | undefined;
  width: number;
  depth: number;
  editMode: boolean;
  moveEnabled: boolean;
  inputBlocked: boolean;
  dragPreview: DragPreview | null;
  activeSlotType: string | null;
  onSelectPlacement: Props["onSelectPlacement"];
  onSelectSlot: Props["onSelectSlot"];
  onDragStart: (placement: HousePlacement, event: ThreeEvent<PointerEvent>) => void;
  onDragMove: (event: ThreeEvent<PointerEvent>) => void;
  onDragEnd: (event: ThreeEvent<PointerEvent>) => void;
  onDragCancel: (event: ThreeEvent<PointerEvent>) => void;
  suppressClick: (placement: HousePlacement) => boolean;
}) {
  const overlayPortal = useContext(RoomOverlayContext);
  const [hovered, setHovered] = useState(false);
  const position =
    placement && hasRoomPosition(placement)
      ? roomPercentToPosition(placement.x, placement.y, width, depth)
      : slotPosition(slot, width, depth);
  const moving = placement && dragPreview?.placementId === placement.id;
  const displayPosition: [number, number, number] = moving
    ? [dragPreview.x, 0.2, dragPreview.z]
    : position;
  if (!placement && !editMode) return null;
  const artKey = placement?.art_key;
  const safeArtKey = artKey && /^[a-z0-9-]+$/i.test(artKey) ? artKey : null;
  const showHint = hovered && !editMode && !inputBlocked && !!placement;
  const hoverProps = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = "";
    },
  };
  return (
    <group
      name={placement ? `accessory:${placement.id}` : `slot:${slot.id}`}
      position={displayPosition}
    >
      {placement ? (
        <group
          onPointerDown={(event) => {
            if (!inputBlocked && editMode && moveEnabled && event.button === 0 && event.isPrimary)
              onDragStart(placement, event);
          }}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
          {...hoverProps}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= 4 && !inputBlocked && !suppressClick(placement))
              onSelectPlacement(placement);
          }}
        >
          <group
            rotation={[0, (-(placement.rotation_deg ?? 0) * Math.PI) / 180, 0]}
            scale={WORLD_SCALE.furniture}
          >
            <FurnitureFallback
              artKey={safeArtKey ?? undefined}
              slotType={slot.slot_type}
              hovered={hovered && !editMode}
            />
          </group>
          {editMode && hovered && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[0.36, 0.42, 48]} />
              <meshBasicMaterial color="#f2c14e" transparent opacity={0.9} depthWrite={false} />
            </mesh>
          )}
          {showHint && (
            <Html
              portal={overlayPortal}
              zIndexRange={[8, 0]}
              center
              position={[0, 0.9, 0]}
              style={{ pointerEvents: "none" }}
            >
              <span className="house-food-package-label">Tap to use</span>
            </Html>
          )}
        </group>
      ) : (
        <mesh
          castShadow
          receiveShadow
          {...hoverProps}
          onClick={(event) => {
            event.stopPropagation();
            if (!inputBlocked && (activeSlotType === null || activeSlotType === slot.slot_type))
              onSelectSlot(slot);
          }}
        >
          <boxGeometry args={[0.48, 0.08, 0.48]} />
          <WorldMaterial tone={activeSlotType === slot.slot_type || hovered ? "slate" : "clay"} />
        </mesh>
      )}
      {editMode && !placement && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
          <ringGeometry args={[0.14, 0.18, 36]} />
          <meshBasicMaterial
            color={hovered ? "#f2c14e" : "#ffffff"}
            transparent
            opacity={hovered ? 0.95 : 0.6}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

export function HouseRoom3D({
  inputBlocked = false,
  houseTypeId,
  characterName = "Your character",
  appearance = {},
  gender = "nonbinary",
  equipment = [],
  animationState = "idle",
  actorPosition,
  actorFacing = "south",
  taskPose,
  onWalk,
  onCollectPackage,
  activityRequestId = null,
  activityLabel = null,
  slots,
  placements,
  foodDeliveries = [],
  movingPlacement = null,
  editMode,
  moveEnabled,
  onSelectPlacement,
  onSelectSlot,
  onMove,
  onMovePosition,
  draftMove = null,
  onDraftMove,
}: Props & { inputBlocked?: boolean }) {
  const [width, depth] = ROOM_SIZE[houseTypeId] ?? ROOM_SIZE["shared-room"]!;
  const bySlot = useMemo(() => new Map(placements.map((item) => [item.slot, item])), [placements]);
  const bedPlacement = placements.find((placement) => placement.slot_type === "bed");
  const bedSlot = slots.find((slot) => slot.id === bedPlacement?.slot);
  const bedSlotPosition =
    bedPlacement && hasRoomPosition(bedPlacement)
      ? roomPercentToPosition(bedPlacement.x, bedPlacement.y, width, depth)
      : bedSlot
        ? slotPosition(bedSlot, width, depth)
        : null;
  const bedPosition: [number, number, number] | null = bedSlotPosition
    ? [bedSlotPosition[0], 0.06, bedSlotPosition[2]]
    : null;
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  // In placement mode the draft item shows at its draft spot; a live drag overrides it.
  const draftPreview: DragPreview | null = draftMove
    ? (() => {
        const [x, , z] = roomPercentToPosition(draftMove.x, draftMove.y, width, depth);
        return { placementId: draftMove.placementId, x, z };
      })()
    : null;
  const activePreview = dragPreview ?? draftPreview;
  const dragPointer = useRef<DragPointer | null>(null);
  const overlayHost = useRef<HTMLDivElement>(null!);
  const suppressClickId = useRef<string | null>(null);
  const floorPoint = (event: ThreeEvent<PointerEvent>) =>
    event.ray.intersectPlane(FLOOR_PLANE, new Vector3());
  const onDragStart = (placement: HousePlacement, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const target = event.target as
      (EventTarget & { setPointerCapture?: (id: number) => void }) | null;
    target?.setPointerCapture?.(event.pointerId);
    dragPointer.current = {
      placement,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    const original = slots.find((slot) => slot.id === placement.slot);
    if (original || hasRoomPosition(placement)) {
      const position =
        hasRoomPosition(placement) || !original
          ? roomPercentToPosition(placement.x ?? 50, placement.y ?? 50, width, depth)
          : slotPosition(original, width, depth);
      setDragPreview({ placementId: placement.id, x: position[0], z: position[2] });
    }
  };
  const onDragMove = (event: ThreeEvent<PointerEvent>) => {
    const pointer = dragPointer.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (draftMove && pointer.placement.id !== draftMove.placementId) return;
    event.stopPropagation();
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6 && !pointer.moved)
      return;
    pointer.moved = true;
    const point = floorPoint(event);
    if (!point) return;
    const [percentX, percentY] = roomCoordinatesToPercent(point.x, point.z, width, depth);
    const [snapX, snapY] = snapToHouseGrid(percentX, percentY);
    const [x, , z] = roomPercentToPosition(snapX, snapY, width, depth);
    setDragPreview({ placementId: pointer.placement.id, x, z });
  };
  const onDragEnd = (event: ThreeEvent<PointerEvent>) => {
    const pointer = dragPointer.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const target = event.target as
      (EventTarget & { releasePointerCapture?: (id: number) => void }) | null;
    target?.releasePointerCapture?.(event.pointerId);
    dragPointer.current = null;
    setDragPreview(null);
    if (!pointer.moved) return;
    suppressClickId.current = pointer.placement.id;
    window.setTimeout(() => {
      if (suppressClickId.current === pointer.placement.id) suppressClickId.current = null;
    }, 0);
    const point = floorPoint(event);
    if (point) {
      const [percentX, percentY] = roomCoordinatesToPercent(point.x, point.z, width, depth);
      const [x, y] = snapToHouseGrid(percentX, percentY);
      // One item per grid cell: a drop onto an occupied cell leaves the item where it was.
      if (isHouseGridCellOccupied(x, y, placements, pointer.placement.id)) return;
      if (draftMove) {
        if (draftMove.placementId === pointer.placement.id) onDraftMove?.(x, y);
        return;
      }
      onMovePosition(pointer.placement, x, y);
    }
  };
  const onDragCancel = (event: ThreeEvent<PointerEvent>) => {
    if (dragPointer.current?.pointerId !== event.pointerId) return;
    dragPointer.current = null;
    setDragPreview(null);
  };
  const suppressClick = (placement: HousePlacement) => {
    if (suppressClickId.current !== placement.id) return false;
    suppressClickId.current = null;
    return true;
  };
  useEffect(() => {
    if (editMode && moveEnabled) return;
    dragPointer.current = null;
    setDragPreview(null);
  }, [editMode, inputBlocked, moveEnabled]);
  const [departing, setDeparting] = useState<WaitingCourier[]>([]);
  const waitingCouriers = useMemo<WaitingCourier[]>(
    () =>
      foodDeliveries
        .filter((delivery) => delivery.deliveryState === "package_waiting")
        .slice(0, 4)
        .map((delivery, index) => ({ delivery, index })),
    [foodDeliveries],
  );
  const previousWaiting = useRef<WaitingCourier[]>([]);
  useEffect(() => {
    const stillWaiting = new Set(waitingCouriers.map((item) => item.delivery.id));
    const left = previousWaiting.current.filter((item) => !stillWaiting.has(item.delivery.id));
    if (left.length)
      setDeparting((current) => [
        ...current,
        ...left.filter((item) => !current.some((c) => c.delivery.id === item.delivery.id)),
      ]);
    previousWaiting.current = waitingCouriers;
  }, [waitingCouriers]);
  return (
    <div className="house-3d-scene" aria-label={`${houseTypeId.replaceAll("-", " ")} 3D room`}>
      <RoomOverlayContext.Provider value={overlayHost}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          shadows
          camera={{
            position: [0, 4, 12],
            fov: 42,
            near: 0.1,
            far: 80,
          }}
          gl={{ antialias: false, powerPreference: "low-power" }}
        >
          <WorldLighting size={Math.max(width, depth) * 1.5} />

          <OsogboRoomPrototype
            houseTypeId={houseTypeId}
            width={width}
            depth={depth}
            editMode={editMode}
          />
          <RoomFloor houseTypeId={houseTypeId} width={width} depth={depth} />
          {!editMode && !inputBlocked && onWalk && (
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.035, 0]}
              onClick={(event) => {
                event.stopPropagation();
                if (event.delta <= 4) onWalk([event.point.x, 0.06, event.point.z]);
              }}
            >
              <planeGeometry args={[width - 0.6, depth - 0.6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          {actorPosition ? (
            <WorldCharacter
              name={characterName}
              appearance={appearance}
              gender={gender}
              equipment={equipment}
              position={actorPosition}
              facing={actorFacing}
              animation={animationState}
              {...(taskPose ? { taskPose } : {})}
            />
          ) : (
            <RoomCharacter
              name={characterName}
              appearance={appearance}
              gender={gender}
              equipment={equipment}
              animationState={animationState}
              activityRequestId={activityRequestId}
              activityLabel={activityLabel}
              position={[0, 0.06, depth * 0.18]}
              bedPosition={bedPosition}
            />
          )}
          {foodDeliveries
            .filter(
              (delivery) =>
                delivery.deliveryState === "awaiting_response" ||
                delivery.deliveryState === "approaching",
            )
            .slice(0, 1)
            .map((delivery) => (
              <FoodCourier
                key={delivery.id}
                delivery={delivery}
                width={width}
                depth={depth}
                index={0}
                onCollect={!inputBlocked && !editMode ? onCollectPackage : undefined}
              />
            ))}
          {foodDeliveries
            .filter((delivery) => delivery.deliveryState === "package_waiting")
            .slice(0, 4)
            .map((delivery, index) => (
              <FoodCourier
                key={delivery.id}
                delivery={delivery}
                width={width}
                depth={depth}
                index={index}
                onCollect={!inputBlocked && !editMode ? onCollectPackage : undefined}
              />
            ))}
          {departing.map(({ delivery, index }) => {
            const inside = delivery.deliveryChoice === "inside";
            return (
              <DepartingCourier
                key={`leaving-${delivery.id}`}
                startX={(inside ? width * 0.13 : width * 0.22) + index * 0.5}
                startZ={inside ? -depth / 2 + 1.35 : -depth / 2 + 0.2}
                exitX={width * 0.22}
                exitZ={-depth / 2 - 2.5}
                onGone={() =>
                  setDeparting((current) => current.filter((c) => c.delivery.id !== delivery.id))
                }
              />
            );
          })}
          {/* Placed furniture: reconstructed, compare with your original if anything is off */}
          {placements.map((placement) => {
            const slot = renderSlotForPlacement(placement, slots);
            if (!slot) return null;
            return (
              <SlotObject
                key={placement.id}
                slot={slot}
                placement={placement}
                width={width}
                depth={depth}
                editMode={editMode}
                moveEnabled={moveEnabled}
                inputBlocked={inputBlocked}
                dragPreview={activePreview}
                activeSlotType={
                  activePreview
                    ? (placements.find((item) => item.id === activePreview.placementId)
                        ?.slot_type ?? null)
                    : (movingPlacement?.slot_type ?? null)
                }
                onSelectPlacement={onSelectPlacement}
                onSelectSlot={onSelectSlot}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
                suppressClick={suppressClick}
              />
            );
          })}
          {/* Empty slots (edit mode shows the "+" placeholders) */}
          {slots
            .filter((slot) => !bySlot.has(slot.id))
            .map((slot) => (
              <SlotObject
                key={slot.id}
                slot={slot}
                placement={undefined}
                width={width}
                depth={depth}
                editMode={editMode}
                moveEnabled={moveEnabled}
                inputBlocked={inputBlocked}
                dragPreview={activePreview}
                activeSlotType={
                  activePreview
                    ? (placements.find((item) => item.id === activePreview.placementId)
                        ?.slot_type ?? null)
                    : (movingPlacement?.slot_type ?? null)
                }
                onSelectPlacement={onSelectPlacement}
                onSelectSlot={onSelectSlot}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
                suppressClick={suppressClick}
              />
            ))}
          <WorldCamera
            width={width}
            depth={depth}
            stage
            horizontalOrbit={!editMode}
            verticalOrbit={!editMode}
            polarAngle={editMode ? Math.PI / 5 : Math.PI / 4}
            target={editMode ? [0, 0.25, 0] : [0, WORLD_SCALE.door * 0.65, 0]}
            enabled={!inputBlocked && !activePreview}
          />
        </Canvas>
      </RoomOverlayContext.Provider>
      <div
        ref={overlayHost}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      {!editMode && (
        <div className="house-keyboard-accessories" role="group" aria-label="Home accessories">
          {placements
            .filter((item) => homeFurnitureAction(item.item_id))
            .map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={inputBlocked}
                onClick={() => onSelectPlacement(item)}
              >
                Use {item.item_id.replaceAll("-", " ")}
              </button>
            ))}
        </div>
      )}
      {editMode && (
        <div className="house-3d-arrange-hint" role="status">
          {dragPreview
            ? "Release to set the spot"
            : draftMove
              ? "Drag the item to a grid cell, then press Place"
              : moveEnabled
                ? "Drag accessories anywhere on the floor"
                : "Finish saving before moving another accessory"}
        </div>
      )}
    </div>
  );
}
