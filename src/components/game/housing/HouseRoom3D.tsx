import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
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
  roomPercentToPosition,
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
            <WorldMaterial tone="window" />
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

function FurnitureFallback({ artKey, slotType }: { artKey: string | undefined; slotType: string }) {
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
        <mesh castShadow receiveShadow position={[0, 0.14, 0]}>
          <boxGeometry args={[0.95, 0.18, 1.35]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.27, 0]}>
          <boxGeometry args={[0.88, 0.12, 1.22]} />
          <WorldMaterial tone="linen" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.48, -0.66]}>
          <boxGeometry args={[0.98, 0.62, 0.1]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.35, 0.43]}>
          <boxGeometry args={[0.87, 0.035, 0.27]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-0.23, 0.23].map((x) => (
          <mesh castShadow receiveShadow key={`bed-textile-${x}`} position={[x, 0.38, 0.43]}>
            <boxGeometry args={[0.07, 0.04, 0.29]} />
            <WorldMaterial tone="clay" />
          </mesh>
        ))}
        <mesh castShadow receiveShadow position={[-0.23, 0.36, -0.4]}>
          <boxGeometry args={[0.36, 0.07, 0.25]} />
          <WorldMaterial tone="linen" />
        </mesh>
        <mesh castShadow receiveShadow position={[0.23, 0.36, -0.4]}>
          <boxGeometry args={[0.36, 0.07, 0.25]} />
          <WorldMaterial tone="linen" />
        </mesh>
      </group>
    );
  if (["sofa", "sofa-2", "seat"].includes(kind))
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.26, 0]}>
          <boxGeometry args={[1.15, 0.34, 0.54]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.54, -0.24]}>
          <boxGeometry args={[1.15, 0.52, 0.14]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.54, 0.43, 0]}>
          <boxGeometry args={[0.12, 0.44, 0.65]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0.54, 0.43, 0]}>
          <boxGeometry args={[0.12, 0.44, 0.65]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-0.3, 0, 0.3].map((x, index) => (
          <mesh castShadow receiveShadow key={`sofa-cushion-${x}`} position={[x, 0.53, -0.13]}>
            <boxGeometry args={[0.23, 0.24, 0.09]} />
            <WorldMaterial tone={index === 1 ? "wall" : "clay"} />
          </mesh>
        ))}
      </group>
    );
  if (kind === "television" || kind === "computer")
    return (
      <group>
        {kind === "computer" && (
          <mesh castShadow receiveShadow position={[0, 0.23, 0]}>
            <boxGeometry args={[0.9, 0.12, 0.5]} />
            <WorldMaterial tone="timber" />
          </mesh>
        )}
        <mesh castShadow receiveShadow position={[0, 0.58, -0.08]}>
          <boxGeometry args={[kind === "computer" ? 0.62 : 0.92, 0.53, 0.08]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.58, -0.03]}>
          <planeGeometry args={[kind === "computer" ? 0.55 : 0.85, 0.45]} />
          <WorldMaterial tone="slate" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.28, -0.08]}>
          <boxGeometry args={[0.08, 0.15, 0.08]} />
          <WorldMaterial tone="timber" />
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
  if (kind === "shower")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.06, 16]} />
          <WorldMaterial tone="linen" />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.25, 0.62, -0.2]}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
          <WorldMaterial tone="wall" />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.1, 1.17, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.34, 8]} />
          <WorldMaterial tone="wall" />
        </mesh>
        <mesh castShadow receiveShadow position={[0.04, 1.15, -0.2]}>
          <cylinderGeometry args={[0.15, 0.12, 0.04, 12]} />
          <WorldMaterial tone="wall" />
        </mesh>
      </group>
    );
  if (kind === "plant")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.24, 0.17, 0.36, 10]} />
          <WorldMaterial tone="clay" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.35, 10, 8]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.16, 0.76, 0.03]}>
          <sphereGeometry args={[0.2, 8, 6]} />
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
        <mesh castShadow receiveShadow position={[0, 0.7, 0]}>
          <boxGeometry args={[0.92, 1.4, 0.48]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.69, 0.25]}>
          <boxGeometry args={[0.78, 1.17, 0.025]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh castShadow receiveShadow key={`wardrobe-inlay-${x}`} position={[x, 0.69, 0.27]}>
            <boxGeometry args={[0.035, 1.02, 0.015]} />
            <WorldMaterial tone="clay" />
          </mesh>
        ))}
        <mesh castShadow receiveShadow position={[0, 0.2, 0.27]}>
          <boxGeometry args={[0.82, 0.035, 0.02]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh castShadow receiveShadow key={x} position={[x, 0.72, 0.25]}>
            <boxGeometry args={[0.035, 0.13, 0.025]} />
            <WorldMaterial tone="wall" />
          </mesh>
        ))}
      </group>
    );
  if (kind === "coffee-table")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.43, 0]}>
          <boxGeometry args={[1.05, 0.1, 0.65]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-0.42, 0.42].flatMap((x) =>
          [-0.23, 0.23].map((z) => (
            <mesh castShadow receiveShadow key={`${x}-${z}`} position={[x, 0.22, z]}>
              <boxGeometry args={[0.08, 0.4, 0.08]} />
              <WorldMaterial tone="timber" />
            </mesh>
          )),
        )}
      </group>
    );
  if (kind === "wall-art")
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.7, 0]}>
          <boxGeometry args={[0.76, 0.62, 0.045]} />
          <WorldMaterial tone="timber" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.7, 0.03]}>
          <planeGeometry args={[0.65, 0.5]} />
          <WorldMaterial tone="timber" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            castShadow
            receiveShadow
            key={`wall-art-motif-${side}`}
            position={[side * 0.14, 0.7, 0.045]}
            rotation={[0, 0, Math.PI / 4]}
          >
            <boxGeometry args={[0.12, 0.12, 0.02]} />
            <WorldMaterial tone="clay" />
          </mesh>
        ))}
        <mesh castShadow receiveShadow position={[0, 0.7, 0.05]}>
          <boxGeometry args={[0.035, 0.35, 0.02]} />
          <WorldMaterial tone="clay" />
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

function FoodCourier({
  delivery,
  width,
  depth,
}: {
  delivery: FoodDelivery;
  width: number;
  depth: number;
}) {
  const overlayPortal = useContext(RoomOverlayContext);
  const doorX = width * 0.22;
  const doorZ = -depth / 2 + 0.2;
  const targetX = delivery.deliveryChoice === "inside" ? width * 0.13 : doorX;
  const targetZ = delivery.deliveryChoice === "inside" ? -depth / 2 + 1.35 : doorZ;
  const [position, setPosition] = useState<[number, number, number]>([doorX, 0.06, doorZ]);
  const approaching = delivery.deliveryState === "approaching";
  const walkingInside = approaching && delivery.deliveryChoice === "inside";

  useEffect(() => {
    const doorPosition: [number, number, number] = [doorX, 0.06, doorZ];
    const targetPosition: [number, number, number] = [targetX, 0.06, targetZ];
    if (!approaching) {
      setPosition(doorPosition);
      return;
    }

    const from = [...doorPosition] as [number, number, number];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPosition(targetPosition);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1800);
      setPosition([
        from[0] + (targetPosition[0] - from[0]) * progress,
        from[1] + (targetPosition[1] - from[1]) * progress,
        from[2] + (targetPosition[2] - from[2]) * progress,
      ]);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [approaching, doorX, doorZ, targetX, targetZ]);

  return (
    <>
      <WorldCharacter
        name="Food courier"
        gender="male"
        position={position}
        animation={approaching ? (walkingInside ? "walk" : "idle") : "talk"}
        facing="south"
      />
      <group position={position}>
        <mesh castShadow receiveShadow position={[0.2, 0.98, -0.02]}>
          <boxGeometry args={[0.38, 0.52, 0.22]} />
          <WorldMaterial tone="clay" />
        </mesh>
      </group>
      {delivery.deliveryState === "awaiting_response" && (
        <Html
          portal={overlayPortal}
          zIndexRange={[8, 0]}
          center
          position={[position[0], position[1] + 2.15, position[2]]}
          style={{ pointerEvents: "none" }}
        >
          <span className="house-courier-knock">Knock knock</span>
        </Html>
      )}
    </>
  );
}

function FoodPackage({
  delivery,
  position,
}: {
  delivery: FoodDelivery;
  position: [number, number, number];
}) {
  const overlayPortal = useContext(RoomOverlayContext);
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[0.5, 0.38, 0.42]} />
        <WorldMaterial tone="clay" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.52, 0.035, 0.44]} />
        <WorldMaterial tone="timber" />
      </mesh>
      <Html
        portal={overlayPortal}
        zIndexRange={[8, 0]}
        center
        position={[0, 0.68, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span className="house-food-package-label">{delivery.vendorName}</span>
      </Html>
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
  const position =
    placement && hasRoomPosition(placement)
      ? roomPercentToPosition(placement.x, placement.y, width, depth)
      : slotPosition(slot, width, depth);
  const moving = placement && dragPreview?.placementId === placement.id;
  const displayPosition: [number, number, number] = moving
    ? [dragPreview.x, 0.2, dragPreview.z]
    : position;
  if (!placement && !editMode) return null;
  const label = placement?.item_id.replaceAll("-", " ") ?? `Place in ${slot.slot_type} slot`;
  const artKey = placement?.art_key;
  const safeArtKey = artKey && /^[a-z0-9-]+$/i.test(artKey) ? artKey : null;
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
          onClick={(event) => {
            event.stopPropagation();
            if (!inputBlocked && !suppressClick(placement)) onSelectPlacement(placement);
          }}
        >
          <group scale={WORLD_SCALE.furniture}>
            <FurnitureFallback artKey={safeArtKey ?? undefined} slotType={slot.slot_type} />
          </group>
        </group>
      ) : (
        <mesh
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            if (!inputBlocked && (activeSlotType === null || activeSlotType === slot.slot_type))
              onSelectSlot(slot);
          }}
        >
          <boxGeometry args={[0.48, 0.08, 0.48]} />
          <WorldMaterial tone={activeSlotType === slot.slot_type ? "slate" : "clay"} />
        </mesh>
      )}
      {editMode && !placement && (
        <Html
          portal={overlayPortal}
          zIndexRange={[8, 0]}
          style={{ pointerEvents: "auto" }}
          center
          position={[0, 0.46, 0]}
          distanceFactor={10}
        >
          <button
            type="button"
            className="house-3d-slot-label"
            aria-label={label}
            title={label}
            disabled={
              inputBlocked ||
              (!!activeSlotType && activeSlotType !== slot.slot_type) ||
              (!!placement && !!activeSlotType)
            }
            onClick={() => (placement ? onSelectPlacement(placement) : onSelectSlot(slot))}
          >
            {placement ? "•••" : "+"}
          </button>
        </Html>
      )}
    </group>
  );
}

function FitCamera({ width, depth }: { width: number; depth: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = size.width / size.height;
    cam.updateProjectionMatrix();

    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
    const halfExtent = (Math.max(width, depth) / 2) * 1.3;
    const distance = halfExtent / Math.tan(Math.min(vFov, hFov) / 2);

    const dir = new THREE.Vector3(0, 4, 12).normalize();
    cam.position.copy(dir.multiplyScalar(distance));
    cam.lookAt(0, 0, 0);
  }, [size.width, size.height, width, depth, camera]);
  return null;
}

export function HouseRoom3D({
  inputBlocked = false,
  houseTypeId,
  characterName = "Your character",
  appearance = {},
  gender = "nonbinary",
  equipment = [],
  animationState = "idle",
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
    if (original) {
      const position = hasRoomPosition(placement)
        ? roomPercentToPosition(placement.x, placement.y, width, depth)
        : slotPosition(original, width, depth);
      setDragPreview({ placementId: placement.id, x: position[0], z: position[2] });
    }
  };
  const onDragMove = (event: ThreeEvent<PointerEvent>) => {
    const pointer = dragPointer.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6 && !pointer.moved)
      return;
    pointer.moved = true;
    const point = floorPoint(event);
    if (!point) return;
    const x = Math.max(-width / 2 + 0.4, Math.min(width / 2 - 0.4, point.x));
    const z = Math.max(-depth / 2 + 0.4, Math.min(depth / 2 - 0.4, point.z));
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
      const [x, y] = roomCoordinatesToPercent(point.x, point.z, width, depth);
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
<FitCamera width={width} depth={depth} />
          <OsogboRoomPrototype
            houseTypeId={houseTypeId}
            width={width}
            depth={depth}
            editMode={editMode}
          />
          <RoomFloor houseTypeId={houseTypeId} width={width} depth={depth} />
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
          {foodDeliveries
            .filter(
              (delivery) =>
                delivery.deliveryState === "awaiting_response" ||
                delivery.deliveryState === "approaching",
            )
            .slice(0, 1)
            .map((delivery) => (
              <FoodCourier key={delivery.id} delivery={delivery} width={width} depth={depth} />
            ))}
          {foodDeliveries
            .filter((delivery) => delivery.deliveryState === "package_waiting")
            .slice(0, 4)
            .map((delivery, index) => (
              <FoodPackage
                key={delivery.id}
                delivery={delivery}
                position={[
                  width * 0.22 + index * 0.56,
                  0.06,
                  -depth / 2 + 0.72 + (index % 2) * 0.46,
                ]}
              />
            ))}
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
                dragPreview={dragPreview}
                activeSlotType={
                  dragPreview
                    ? (placements.find((item) => item.id === dragPreview.placementId)?.slot_type ??
                      null)
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
          {placements.map((placement) => {
            const savedSlot = slots.find((slot) => slot.id === placement.slot);
            const fallbackPosition = hasRoomPosition(placement)
              ? { x: placement.x, y: placement.y }
              : { x: 50, y: 50 };
            const slot =
              savedSlot ??
              ({
                id: placement.slot,
                slot_type: placement.slot_type,
                ...fallbackPosition,
              } satisfies HouseSlot);
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
                dragPreview={dragPreview}
                activeSlotType={
                  dragPreview
                    ? (placements.find((item) => item.id === dragPreview.placementId)?.slot_type ??
                      null)
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
          <WorldCamera
            width={width}
            depth={depth}
            stage
            polarAngle={editMode ? Math.PI / 5 : Math.PI / 4}
            target={editMode ? [0, 0.25, 0] : [0, WORLD_SCALE.door * 0.65, 0]}
            enabled={!inputBlocked && !dragPreview}
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
            ? "Release to place"
            : moveEnabled
              ? "Drag accessories anywhere on the floor"
              : "Finish saving before moving another accessory"}
        </div>
      )}
    </div>
  );
}
