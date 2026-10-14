import { Suspense, memo, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSceneColor } from "@/lib/scene-colors";
import {
  FURNITURE_CATALOG,
  HOME_LAYOUTS,
  type PlacedFurniture,
  type RoomId,
} from "@/lib/housing-service";
import { RoomAvatarSprite } from "@/components/game/housing/RoomAvatarSprite";
import type { Appearance } from "@/game/avatar-appearance";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";

export type HouseRoomId = "lounge" | "den" | "kitchen" | "bedroom";

const ROOMS: Array<{
  id: HouseRoomId;
  position: [number, number, number];
  floor: "wood" | "tile";
  color: string;
}> = [
  { id: "lounge", position: [-3.1, 0, 3.1], floor: "wood", color: getSceneColor("--scene-accent") },
  { id: "den", position: [3.1, 0, 3.1], floor: "tile", color: getSceneColor("--scene-accent") },
  {
    id: "kitchen",
    position: [-3.1, 0, -3.1],
    floor: "tile",
    color: getSceneColor("--scene-accent"),
  },
  {
    id: "bedroom",
    position: [3.1, 0, -3.1],
    floor: "wood",
    color: getSceneColor("--scene-accent"),
  },
];

const ROOM_CENTERS: Record<HouseRoomId, [number, number, number]> = {
  lounge: [-3.1, 0, 3.1],
  den: [3.1, 0, 3.1],
  kitchen: [-3.1, 0, -3.1],
  bedroom: [3.1, 0, -3.1],
};
const ROOM_FOR_SAVE: Record<RoomId, HouseRoomId> = {
  lounge: "lounge",
  dining: "den",
  study: "den",
  kitchen: "kitchen",
  bathroom: "den",
  bedroom: "bedroom",
};
const AVATAR_POINTS: Record<RoomId, [number, number, number]> = {
  lounge: [-3.1, 0.85, 4.72],
  dining: [1.62, 0.85, 3.1],
  study: [4.7, 0.85, 3.1],
  kitchen: [-3.1, 0.85, -1.62],
  bathroom: [4.7, 0.85, -3.1],
  bedroom: [3.1, 0.85, -1.62],
};

type FurniturePlacement = { placement: PlacedFurniture; item: (typeof FURNITURE_CATALOG)[number] };

function savedFurniturePosition({ placement, item }: FurniturePlacement): [number, number, number] {
  const room = HOME_LAYOUTS.find((layout) =>
    layout.rooms.some((entry) => entry.id === placement.room),
  )?.rooms.find((entry) => entry.id === placement.room);
  const center = ROOM_CENTERS[ROOM_FOR_SAVE[placement.room]];
  const cell = 0.68;
  const localX = (placement.x + (item.width - 1) / 2 - ((room?.width ?? 6) - 1) / 2) * cell;
  const localZ = (placement.y + (item.height - 1) / 2 - ((room?.height ?? 6) - 1) / 2) * cell;
  const [offsetX, offsetY, offsetZ] = item.scenePosition ?? [0, 0, 0];
  return [center[0] + localX + offsetX, 0.08 + offsetY, center[2] + localZ + offsetZ];
}

const PlacedFurnitureModel = memo(function PlacedFurnitureModel({
  placement,
  item,
}: FurniturePlacement) {
  const width = Math.max(0.55, Math.min(1.55, item.width * 0.62));
  const depth = Math.max(0.55, Math.min(1.55, item.height * 0.62));
  const position = savedFurniturePosition({ placement, item });
  return (
    <group position={position} rotation={[0, (placement.rotation * Math.PI) / 180, 0]}>
      {item.id === "sofa" ? (
        <>
          <Box
            position={[0, 0.28, 0]}
            size={[width, 0.38, depth]}
            color={getSceneColor("--scene-accent")}
          />
          <Box
            position={[0, 0.62, -depth * 0.39]}
            size={[width * 0.9, 0.52, 0.18]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[-width * 0.44, 0.4, 0]}
            size={[0.16, 0.52, depth]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[width * 0.44, 0.4, 0]}
            size={[0.16, 0.52, depth]}
            color={getSceneColor("--scene-building")}
          />
        </>
      ) : item.id === "bed" ? (
        <>
          <Box
            position={[0, 0.22, 0]}
            size={[width, 0.4, depth]}
            color={getSceneColor("--scene-building-edge")}
          />
          <Box
            position={[0, 0.48, 0]}
            size={[width * 0.94, 0.14, depth * 0.9]}
            color={getSceneColor("--brand-cream")}
          />
          <Box
            position={[0, 0.62, -depth * 0.32]}
            size={[width * 0.38, 0.12, depth * 0.2]}
            color={getSceneColor("--brand-porcelain")}
          />
        </>
      ) : item.id === "plant" ? (
        <>
          <mesh position={[0, 0.28, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.52, 8]} />
            <meshStandardMaterial color={getSceneColor("--scene-wood-line")} />
          </mesh>
          <mesh position={[0, 0.82, 0]} castShadow>
            <coneGeometry args={[0.42, 0.85, 7]} />
            <meshStandardMaterial color={getSceneColor("--scene-hill-front")} />
          </mesh>
        </>
      ) : item.id === "stove" ? (
        <>
          <Box
            position={[0, 0.36, 0]}
            size={[width, 0.7, depth]}
            color={getSceneColor("--scene-building")}
          />
          {[-0.22, 0.22].map((x) =>
            [-0.18, 0.18].map((z) => (
              <mesh key={`${x}:${z}`} position={[x, 0.74, z]}>
                <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
                <meshStandardMaterial color={getSceneColor("--brand-ink")} />
              </mesh>
            )),
          )}
        </>
      ) : item.id === "toilet" ? (
        <>
          <Box
            position={[0, 0.22, 0]}
            size={[0.46, 0.42, 0.52]}
            color={getSceneColor("--brand-porcelain")}
          />
          <mesh position={[0, 0.49, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.28, 0.25, 0.12, 16]} />
            <meshStandardMaterial color={getSceneColor("--brand-porcelain")} />
          </mesh>
          <Box
            position={[0, 0.56, -0.25]}
            size={[0.42, 0.58, 0.18]}
            color={getSceneColor("--brand-porcelain")}
          />
        </>
      ) : item.id === "shower" ? (
        <>
          <Box
            position={[0.24, 0.95, 0]}
            size={[0.08, 1.8, 0.08]}
            color={getSceneColor("--scene-building-edge")}
          />
          <Box
            position={[0, 1.76, 0]}
            size={[0.58, 0.08, 0.08]}
            color={getSceneColor("--scene-building-edge")}
          />
          <Box
            position={[-0.22, 0.18, 0]}
            size={[0.08, 0.36, depth]}
            color={getSceneColor("--scene-sky")}
          />
        </>
      ) : item.id === "computer" || item.id === "television" ? (
        <>
          <Box
            position={[0, 0.46, 0]}
            size={[width, 0.12, depth]}
            color={getSceneColor("--scene-wood-line")}
          />
          <Box
            position={[0, 0.86, -depth * 0.3]}
            size={[width * 0.58, 0.64, 0.1]}
            color={getSceneColor("--brand-ink")}
          />
          <Box
            position={[0, 0.86, -depth * 0.23]}
            size={[width * 0.49, 0.48, 0.025]}
            color={getSceneColor("--scene-sky")}
          />
          <Box
            position={[-width * 0.38, 0.22, 0]}
            size={[0.08, 0.44, 0.08]}
            color={getSceneColor("--scene-wood-line")}
          />
          <Box
            position={[width * 0.38, 0.22, 0]}
            size={[0.08, 0.44, 0.08]}
            color={getSceneColor("--scene-wood-line")}
          />
        </>
      ) : null}
    </group>
  );
});

const FurnitureLayer = memo(function FurnitureLayer({
  furniture,
}: {
  furniture: PlacedFurniture[];
}) {
  const renderable = useMemo(() => {
    const result: FurniturePlacement[] = [];
    for (const placement of furniture) {
      const item = FURNITURE_CATALOG.find((entry) => entry.id === placement.itemId);
      if (!item) {
        console.warn(`[HomeScene] Skipping unknown furniture catalogue item: ${placement.itemId}`);
        continue;
      }
      if (!item.scenePosition) {
        console.warn(`[HomeScene] Skipping ${item.id}: no catalogue scene position is defined.`);
        continue;
      }
      result.push({ placement, item });
    }
    return result;
  }, [furniture]);
  return renderable.map((entry) => <PlacedFurnitureModel key={entry.placement.id} {...entry} />);
});

function makeFloorTexture(kind: "wood" | "tile") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const fillToken = kind === "wood" ? "--scene-wood" : "--scene-tile";
  const lineToken = kind === "wood" ? "--scene-wood-line" : "--scene-tile-line";
  context.fillStyle = getSceneColor(fillToken);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = getSceneColor(lineToken);
  context.lineWidth = 1;
  for (let offset = 64; offset < 256; offset += 64) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, 256);
    context.moveTo(0, offset);
    context.lineTo(256, offset);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 4;
  return texture;
}
function Box({
  position,
  size,
  color,
  material = "standard",
  opacity = 1,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  material?: "standard" | "glass" | "metal";
  opacity?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      {material === "glass" ? (
        <meshPhysicalMaterial
          color={color}
          roughness={0.12}
          metalness={0.08}
          transmission={0.55}
          thickness={0.04}
          transparent
          opacity={opacity}
        />
      ) : (
        <meshStandardMaterial
          color={color}
          roughness={material === "metal" ? 0.28 : 0.78}
          metalness={material === "metal" ? 0.62 : 0.02}
        />
      )}
    </mesh>
  );
}

function WindowUnit({
  position,
  width,
  orientation = "back",
}: {
  position: [number, number, number];
  width: number;
  orientation?: "back" | "side";
}) {
  const acrossX = orientation === "back";
  return (
    <group position={position}>
      <Box
        position={[0, 0, 0]}
        size={acrossX ? [width - 0.18, 1.02, 0.05] : [0.05, 1.02, width - 0.18]}
        color={getSceneColor("--scene-sky")}
        material="glass"
        opacity={0.72}
      />
      {acrossX ? (
        <>
          <Box
            position={[0, 0.56, 0]}
            size={[width, 0.09, 0.16]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[0, -0.56, 0]}
            size={[width, 0.09, 0.16]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[-width / 2 + 0.04, 0, 0]}
            size={[0.09, 1.15, 0.16]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[width / 2 - 0.04, 0, 0]}
            size={[0.09, 1.15, 0.16]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[0, 0, 0.01]}
            size={[0.045, 1.05, 0.17]}
            color={getSceneColor("--scene-building")}
          />
        </>
      ) : (
        <>
          <Box
            position={[0, 0.56, 0]}
            size={[0.16, 0.09, width]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[0, -0.56, 0]}
            size={[0.16, 0.09, width]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[0, 0, -width / 2 + 0.04]}
            size={[0.16, 1.15, 0.09]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[0, 0, width / 2 - 0.04]}
            size={[0.16, 1.15, 0.09]}
            color={getSceneColor("--scene-building")}
          />
          <Box
            position={[0.01, 0, 0]}
            size={[0.17, 1.05, 0.045]}
            color={getSceneColor("--scene-building")}
          />
        </>
      )}
      <Box
        position={acrossX ? [0, -0.59, 0.02] : [0.02, -0.59, 0]}
        size={acrossX ? [width + 0.2, 0.1, 0.18] : [0.18, 0.1, width + 0.2]}
        color={getSceneColor("--scene-building-edge")}
      />
    </group>
  );
}

function EntryDoor() {
  return (
    <group position={[-3.1, 0, 6.16]}>
      <Box
        position={[-0.58, 1.05, 0]}
        size={[0.16, 2.1, 0.18]}
        color={getSceneColor("--scene-building")}
      />
      <Box
        position={[0.58, 1.05, 0]}
        size={[0.16, 2.1, 0.18]}
        color={getSceneColor("--scene-building")}
      />
      <Box
        position={[0, 2.08, 0]}
        size={[1.3, 0.16, 0.18]}
        color={getSceneColor("--scene-building")}
      />
      <group position={[-0.48, 0.98, 0.12]} rotation={[0, -0.5, 0]}>
        <Box
          position={[0.48, 0.05, 0]}
          size={[0.96, 1.9, 0.09]}
          color={getSceneColor("--scene-wood-line")}
        />
        <mesh position={[0.82, 0.05, 0.055]} castShadow>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial
            color={getSceneColor("--scene-accent")}
            metalness={0.72}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}

function RoomFloor({
  room,
  texture,
  selected,
  onSelect,
}: {
  room: (typeof ROOMS)[number];
  texture: THREE.CanvasTexture | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <group position={room.position}>
      <mesh
        position={[0, -0.12, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={[6.05, 0.24, 6.05]} />
        <meshStandardMaterial color={getSceneColor("--scene-building-edge")} roughness={0.9} />
      </mesh>
      <mesh
        position={[0, 0.006, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial
          map={texture}
          color={getSceneColor("--scene-marking")}
          roughness={0.8}
        />
      </mesh>
      {selected && (
        <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.88, 5.88]} />
          <meshBasicMaterial color={room.color} transparent opacity={0.09} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function HouseStructure() {
  const wall = getSceneColor("--scene-building");
  const inner = getSceneColor("--scene-building");
  return (
    <group>
      {/* Open-front cutaway shell keeps all four room floors visible. */}
      <Box position={[-6.18, 1.1, 0]} size={[0.22, 2.2, 12.4]} color={wall} />
      <Box position={[6.18, 1.1, -4.78]} size={[0.22, 2.2, 2.84]} color={wall} />
      <Box position={[6.18, 1.1, 2.18]} size={[0.22, 2.2, 6.84]} color={wall} />
      <Box position={[-2.83, 1.1, -6.18]} size={[6.74, 2.2, 0.22]} color={wall} />
      <Box position={[4.63, 1.1, -6.18]} size={[3.14, 2.2, 0.22]} color={wall} />
      <Box position={[-4.85, 0.38, 6.18]} size={[2.7, 0.76, 0.22]} color={wall} />
      <Box position={[1.95, 0.38, 6.18]} size={[8.4, 0.76, 0.22]} color={wall} />

      {/* Low cross partitions and clear doorway openings between the rooms. */}
      <Box position={[0, 0.78, -4.85]} size={[0.16, 1.56, 2.7]} color={inner} />
      <Box position={[0, 0.78, -1.65]} size={[0.16, 1.56, 1.8]} color={inner} />
      <Box position={[0, 0.78, 4.85]} size={[0.16, 1.56, 2.7]} color={inner} />
      <Box position={[0, 0.78, 1.65]} size={[0.16, 1.56, 1.8]} color={inner} />
      <Box position={[-4.85, 0.78, 0]} size={[2.7, 1.56, 0.16]} color={inner} />
      <Box position={[-1.65, 0.78, 0]} size={[1.8, 1.56, 0.16]} color={inner} />
      <Box position={[4.85, 0.78, 0]} size={[2.7, 1.56, 0.16]} color={inner} />
      <Box position={[1.65, 0.78, 0]} size={[1.8, 1.56, 0.16]} color={inner} />

      {/* Brass-toned thresholds make the internal door openings legible. */}
      <Box
        position={[0, 0.05, -3.1]}
        size={[0.2, 0.08, 1.12]}
        color={getSceneColor("--scene-accent")}
        material="metal"
      />
      <Box
        position={[0, 0.05, 3.1]}
        size={[0.2, 0.08, 1.12]}
        color={getSceneColor("--scene-accent")}
        material="metal"
      />
      <Box
        position={[-3.1, 0.05, 0]}
        size={[1.12, 0.08, 0.2]}
        color={getSceneColor("--scene-accent")}
        material="metal"
      />
      <Box
        position={[3.1, 0.05, 0]}
        size={[1.12, 0.08, 0.2]}
        color={getSceneColor("--scene-accent")}
        material="metal"
      />

      <WindowUnit position={[1.8, 1.48, -6.18]} width={2.3} />
      <WindowUnit position={[6.18, 1.48, -2.3]} width={2.1} orientation="side" />
      <EntryDoor />

      {/* Small entry terrace and step. */}
      <Box
        position={[-3.1, -0.13, 6.85]}
        size={[3.5, 0.22, 1.25]}
        color={getSceneColor("--scene-building-edge")}
      />
      <Box
        position={[-3.1, -0.26, 7.42]}
        size={[2.7, 0.16, 0.35]}
        color={getSceneColor("--scene-building-edge")}
      />
      <Box
        position={[-6.17, 1.02, 0]}
        size={[0.34, 0.12, 12.3]}
        color={getSceneColor("--scene-building-edge")}
      />
      <Box
        position={[6.17, 1.02, -0.28]}
        size={[0.34, 0.12, 11.7]}
        color={getSceneColor("--scene-building-edge")}
      />
      <Box
        position={[0, 1.02, -6.17]}
        size={[12.3, 0.12, 0.34]}
        color={getSceneColor("--scene-building-edge")}
      />
    </group>
  );
}

function SceneControls() {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControlsImpl(camera, gl.domElement), [camera, gl]);

  useEffect(() => {
    controls.target.set(0, 0.2, 0);
    controls.minDistance = 14;
    controls.maxDistance = 25;
    controls.minPolarAngle = 0.48;
    controls.maxPolarAngle = 1.18;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.7;
    controls.update();
    return () => controls.dispose();
  }, [controls]);

  useFrame(() => controls.update());
  return null;
}

function SceneContents({
  selectedRoom,
  lightsOn,
  onSelectRoom,
  furniture,
  avatarRoom,
  appearance,
  gender,
  equipment,
}: {
  selectedRoom: HouseRoomId;
  lightsOn: boolean;
  onSelectRoom: (room: HouseRoomId) => void;
  furniture: PlacedFurniture[];
  avatarRoom: RoomId;
  appearance: Appearance;
  gender: string;
  equipment: readonly { slot: string }[];
}) {
  const woodTexture = useMemo(() => makeFloorTexture("wood"), []);
  const tileTexture = useMemo(() => makeFloorTexture("tile"), []);
  useEffect(
    () => () => {
      woodTexture?.dispose();
      tileTexture?.dispose();
    },
    [woodTexture, tileTexture],
  );

  return (
    <>
      <color
        attach="background"
        args={[lightsOn ? getSceneColor("--brand-porcelain") : getSceneColor("--brand-ink")]}
      />
      <ambientLight intensity={lightsOn ? 1.35 : 0.48} />
      <hemisphereLight
        args={[
          lightsOn ? getSceneColor("--brand-cream") : getSceneColor("--brand-slate"),
          getSceneColor("--scene-road"),
          0.7,
        ]}
      />
      <directionalLight
        position={[-8, 13, 9]}
        intensity={lightsOn ? 2.1 : 0.55}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0003}
      />
      <pointLight
        position={[-3, 3.4, 2.8]}
        color={getSceneColor("--scene-accent")}
        intensity={lightsOn ? 1.1 : 0.12}
      />
      <pointLight
        position={[3, 3.2, -3]}
        color={getSceneColor("--scene-sky")}
        intensity={lightsOn ? 0.65 : 0.08}
      />

      <mesh position={[0, -0.42, 0]} receiveShadow>
        <boxGeometry args={[12.65, 0.32, 12.65]} />
        <meshStandardMaterial color={getSceneColor("--scene-road")} roughness={0.9} />
      </mesh>
      {ROOMS.map((room) => (
        <RoomFloor
          key={room.id}
          room={room}
          texture={room.floor === "wood" ? woodTexture : tileTexture}
          selected={room.id === selectedRoom}
          onSelect={() => onSelectRoom(room.id)}
        />
      ))}
      <HouseStructure />
      <FurnitureLayer furniture={furniture} />
      <RoomAvatarSprite
        position={AVATAR_POINTS[avatarRoom]}
        appearance={appearance}
        gender={gender}
        equipment={equipment}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.16} />
      </mesh>
      <SceneControls />
    </>
  );
}

export function HouseScene({
  selectedRoom,
  lightsOn,
  onSelectRoom,
  furniture,
  avatarRoom,
  appearance,
  gender,
  equipment,
}: {
  selectedRoom: HouseRoomId;
  lightsOn: boolean;
  onSelectRoom: (room: HouseRoomId) => void;
  furniture: PlacedFurniture[];
  avatarRoom: RoomId;
  appearance: Appearance;
  gender: string;
  equipment: readonly { slot: string }[];
}) {
  return (
    <div className={`house-scene ${lightsOn ? "is-lit" : "is-dim"}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        orthographic
        camera={{ position: [15, 18, 16], zoom: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.setClearColor(
            lightsOn ? getSceneColor("--brand-porcelain") : getSceneColor("--brand-ink"),
            1,
          );
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <SceneContents
            selectedRoom={selectedRoom}
            lightsOn={lightsOn}
            onSelectRoom={onSelectRoom}
            furniture={furniture}
            avatarRoom={avatarRoom}
            appearance={appearance}
            gender={gender}
            equipment={equipment}
          />
        </Suspense>
      </Canvas>
      <div className="house-scene-hint" aria-hidden="true">
        Drag to rotate <span>·</span> Scroll to zoom
      </div>
    </div>
  );
}
