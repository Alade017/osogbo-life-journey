import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";

export type HouseRoomId = "lounge" | "den" | "kitchen" | "bedroom";

const ROOMS: Array<{
  id: HouseRoomId;
  position: [number, number, number];
  floor: "wood" | "tile";
  color: string;
}> = [
  { id: "lounge", position: [-3.1, 0, 3.1], floor: "wood", color: "#e8b96f" },
  { id: "den", position: [3.1, 0, 3.1], floor: "tile", color: "#e8b96f" },
  { id: "kitchen", position: [-3.1, 0, -3.1], floor: "tile", color: "#e8b96f" },
  { id: "bedroom", position: [3.1, 0, -3.1], floor: "wood", color: "#e8b96f" },
];

function makeFloorTexture(kind: "wood" | "tile") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (kind === "wood") {
    context.fillStyle = "#805b43";
    context.fillRect(0, 0, 256, 256);
    const plankColors = ["#b6875f", "#c3976d", "#a97a56", "#bd8f67"];
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        context.fillStyle = plankColors[(row * 3 + column) % plankColors.length] ?? "#b6875f";
        context.fillRect(column * 32 + 1, row * 32 + 1, 30, 30);
        context.fillStyle = "rgb(255 235 205 / 12%)";
        context.fillRect(column * 32 + 3, row * 32 + 3, 26, 1);
      }
    }
    context.strokeStyle = "rgb(75 47 33 / 27%)";
    context.lineWidth = 2;
    for (let offset = -256; offset < 512; offset += 64) {
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset + 256, 256);
      context.stroke();
    }
  } else {
    context.fillStyle = "#d6d4ce";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const inset = (row + column) % 2 ? 2 : 4;
        context.fillStyle = (row + column) % 2 ? "#e7e4dd" : "#dfdcd4";
        context.fillRect(column * 64 + inset, row * 64 + inset, 60 - inset, 60 - inset);
      }
    }
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
        color="#a7c9d2"
        material="glass"
        opacity={0.72}
      />
      {acrossX ? (
        <>
          <Box position={[0, 0.56, 0]} size={[width, 0.09, 0.16]} color="#f4ead7" />
          <Box position={[0, -0.56, 0]} size={[width, 0.09, 0.16]} color="#f4ead7" />
          <Box position={[-width / 2 + 0.04, 0, 0]} size={[0.09, 1.15, 0.16]} color="#f4ead7" />
          <Box position={[width / 2 - 0.04, 0, 0]} size={[0.09, 1.15, 0.16]} color="#f4ead7" />
          <Box position={[0, 0, 0.01]} size={[0.045, 1.05, 0.17]} color="#f4ead7" />
        </>
      ) : (
        <>
          <Box position={[0, 0.56, 0]} size={[0.16, 0.09, width]} color="#f4ead7" />
          <Box position={[0, -0.56, 0]} size={[0.16, 0.09, width]} color="#f4ead7" />
          <Box position={[0, 0, -width / 2 + 0.04]} size={[0.16, 1.15, 0.09]} color="#f4ead7" />
          <Box position={[0, 0, width / 2 - 0.04]} size={[0.16, 1.15, 0.09]} color="#f4ead7" />
          <Box position={[0.01, 0, 0]} size={[0.17, 1.05, 0.045]} color="#f4ead7" />
        </>
      )}
      <Box
        position={acrossX ? [0, -0.59, 0.02] : [0.02, -0.59, 0]}
        size={acrossX ? [width + 0.2, 0.1, 0.18] : [0.18, 0.1, width + 0.2]}
        color="#d8c4a3"
      />
    </group>
  );
}

function EntryDoor() {
  return (
    <group position={[-3.1, 0, 6.16]}>
      <Box position={[-0.58, 1.05, 0]} size={[0.16, 2.1, 0.18]} color="#eee0ca" />
      <Box position={[0.58, 1.05, 0]} size={[0.16, 2.1, 0.18]} color="#eee0ca" />
      <Box position={[0, 2.08, 0]} size={[1.3, 0.16, 0.18]} color="#eee0ca" />
      <group position={[-0.48, 0.98, 0.12]} rotation={[0, -0.5, 0]}>
        <Box position={[0.48, 0.05, 0]} size={[0.96, 1.9, 0.09]} color="#755139" />
        <mesh position={[0.82, 0.05, 0.055]} castShadow>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#d1a64f" metalness={0.72} roughness={0.25} />
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
        <meshStandardMaterial color="#c3b8a8" roughness={0.9} />
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
        <meshStandardMaterial map={texture} color="#ffffff" roughness={0.8} />
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
  const wall = "#f3eee5";
  const inner = "#e9e1d4";
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
      <Box position={[0, 0.05, -3.1]} size={[0.2, 0.08, 1.12]} color="#b7955c" material="metal" />
      <Box position={[0, 0.05, 3.1]} size={[0.2, 0.08, 1.12]} color="#b7955c" material="metal" />
      <Box position={[-3.1, 0.05, 0]} size={[1.12, 0.08, 0.2]} color="#b7955c" material="metal" />
      <Box position={[3.1, 0.05, 0]} size={[1.12, 0.08, 0.2]} color="#b7955c" material="metal" />

      <WindowUnit position={[1.8, 1.48, -6.18]} width={2.3} />
      <WindowUnit position={[6.18, 1.48, -2.3]} width={2.1} orientation="side" />
      <EntryDoor />

      {/* Small entry terrace and step. */}
      <Box position={[-3.1, -0.13, 6.85]} size={[3.5, 0.22, 1.25]} color="#b6a48c" />
      <Box position={[-3.1, -0.26, 7.42]} size={[2.7, 0.16, 0.35]} color="#a8957b" />
      <Box position={[-6.17, 1.02, 0]} size={[0.34, 0.12, 12.3]} color="#d9c4a1" />
      <Box position={[6.17, 1.02, -0.28]} size={[0.34, 0.12, 11.7]} color="#d9c4a1" />
      <Box position={[0, 1.02, -6.17]} size={[12.3, 0.12, 0.34]} color="#d9c4a1" />
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
}: {
  selectedRoom: HouseRoomId;
  lightsOn: boolean;
  onSelectRoom: (room: HouseRoomId) => void;
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
      <color attach="background" args={[lightsOn ? "#f0eee8" : "#191d29"]} />
      <ambientLight intensity={lightsOn ? 1.35 : 0.48} />
      <hemisphereLight args={[lightsOn ? "#f7f4eb" : "#667087", "#7a6b5c", 0.7]} />
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
      <pointLight position={[-3, 3.4, 2.8]} color="#ffc978" intensity={lightsOn ? 1.1 : 0.12} />
      <pointLight position={[3, 3.2, -3]} color="#e9f3ff" intensity={lightsOn ? 0.65 : 0.08} />

      <mesh position={[0, -0.42, 0]} receiveShadow>
        <boxGeometry args={[12.65, 0.32, 12.65]} />
        <meshStandardMaterial color="#75634f" roughness={0.9} />
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
}: {
  selectedRoom: HouseRoomId;
  lightsOn: boolean;
  onSelectRoom: (room: HouseRoomId) => void;
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
          gl.setClearColor(lightsOn ? "#f0eee8" : "#191d29", 1);
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <SceneContents
            selectedRoom={selectedRoom}
            lightsOn={lightsOn}
            onSelectRoom={onSelectRoom}
          />
        </Suspense>
      </Canvas>
      <div className="house-scene-hint" aria-hidden="true">
        Drag to rotate <span>·</span> Scroll to zoom
      </div>
    </div>
  );
}
