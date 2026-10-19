import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import type { Group } from "three";
import type { HousePlacement, HouseSlot } from "./HouseRoomScene";

const DRACO_PATH = "/models/draco/";
const ROOM_SIZE: Record<string, readonly [number, number]> = {
  "shared-room": [4.2, 3.4],
  "single-room": [5, 3.8],
  "studio-flat": [6.4, 4.5],
  "mini-flat": [7.4, 5.4],
  bungalow: [8.7, 6.5],
  duplex: [9.6, 7.2],
};
const ACCESSORY_TIER: Record<string, number> = { basic: 1, comfortable: 2, premium: 3 };

type Props = {
  houseTypeId: string;
  accessoryBand: string;
  slots: HouseSlot[];
  placements: HousePlacement[];
  editMode: boolean;
  onSelectPlacement: (placement: HousePlacement) => void;
  onSelectSlot: (slot: HouseSlot) => void;
};

class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: string },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadedModel({ path, tier }: { path: string; tier: number }) {
  const { scene } = useGLTF(path, DRACO_PATH, true);
  const instance = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      const accessory = /^Accessory_Tier(\d+)_/.exec(object.name);
      if (accessory) object.visible = Number(accessory[1]) <= tier;
    });
    return copy;
  }, [scene, tier]);
  return <primitive object={instance as Group} dispose={null} />;
}

function OptionalModel({
  path,
  tier = 1,
  fallback,
}: {
  path: string;
  tier?: number;
  fallback: ReactNode;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!path) {
      setAvailable(false);
      return;
    }
    let mounted = true;
    setAvailable(false);
    void fetch(path, { method: "HEAD" })
      .then((response) => {
        if (mounted) setAvailable(response.ok);
      })
      .catch(() => {
        if (mounted) setAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, [path]);
  if (!path || !available) return fallback;
  return (
    <ModelBoundary resetKey={path} fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedModel path={path} tier={tier} />
      </Suspense>
    </ModelBoundary>
  );
}

function PlaceholderRoom({ width, depth }: { width: number; depth: number }) {
  return (
    <group>
      <mesh position={[0, -0.09, 0]}>
        <boxGeometry args={[width, 0.18, depth]} />
        <meshStandardMaterial color="#d5b995" roughness={1} />
      </mesh>
      <mesh position={[-width / 2, 0.66, 0]}>
        <boxGeometry args={[0.12, 1.32, depth]} />
        <meshStandardMaterial color="#efe3ce" roughness={1} />
      </mesh>
      <mesh position={[0, 0.66, -depth / 2]}>
        <boxGeometry args={[width, 1.32, 0.12]} />
        <meshStandardMaterial color="#e8d5b7" roughness={1} />
      </mesh>
      {width >= 6 && (
        <mesh position={[width * 0.15, 0.4, -depth * 0.12]}>
          <boxGeometry args={[0.1, 0.8, depth * 0.35]} />
          <meshStandardMaterial color="#eadac0" roughness={1} />
        </mesh>
      )}
      {width >= 8 && (
        <mesh position={[-width * 0.16, 0.4, depth * 0.18]}>
          <boxGeometry args={[width * 0.28, 0.8, 0.1]} />
          <meshStandardMaterial color="#eadac0" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

function FurnitureFallback({ artKey, slotType }: { artKey: string | undefined; slotType: string }) {
  const kind = artKey ?? slotType;
  if (kind === "bed")
    return (
      <group>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.95, 0.18, 1.35]} />
          <meshStandardMaterial color="#8a6048" />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <boxGeometry args={[0.88, 0.12, 1.22]} />
          <meshStandardMaterial color="#e7d9b9" />
        </mesh>
        <mesh position={[0, 0.48, -0.66]}>
          <boxGeometry args={[0.98, 0.62, 0.1]} />
          <meshStandardMaterial color="#654838" />
        </mesh>
        <mesh position={[-0.23, 0.36, -0.4]}>
          <boxGeometry args={[0.36, 0.07, 0.25]} />
          <meshStandardMaterial color="#fffaf0" />
        </mesh>
        <mesh position={[0.23, 0.36, -0.4]}>
          <boxGeometry args={[0.36, 0.07, 0.25]} />
          <meshStandardMaterial color="#fffaf0" />
        </mesh>
      </group>
    );
  if (["sofa", "sofa-2", "seat"].includes(kind))
    return (
      <group>
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[1.15, 0.34, 0.54]} />
          <meshStandardMaterial color="#7b8b70" />
        </mesh>
        <mesh position={[0, 0.54, -0.24]}>
          <boxGeometry args={[1.15, 0.52, 0.14]} />
          <meshStandardMaterial color="#65785e" />
        </mesh>
        <mesh position={[-0.54, 0.43, 0]}>
          <boxGeometry args={[0.12, 0.44, 0.65]} />
          <meshStandardMaterial color="#65785e" />
        </mesh>
        <mesh position={[0.54, 0.43, 0]}>
          <boxGeometry args={[0.12, 0.44, 0.65]} />
          <meshStandardMaterial color="#65785e" />
        </mesh>
      </group>
    );
  if (kind === "television" || kind === "computer")
    return (
      <group>
        {kind === "computer" && (
          <mesh position={[0, 0.23, 0]}>
            <boxGeometry args={[0.9, 0.12, 0.5]} />
            <meshStandardMaterial color="#8a6048" />
          </mesh>
        )}
        <mesh position={[0, 0.58, -0.08]}>
          <boxGeometry args={[kind === "computer" ? 0.62 : 0.92, 0.53, 0.08]} />
          <meshStandardMaterial color="#252c35" />
        </mesh>
        <mesh position={[0, 0.58, -0.03]}>
          <planeGeometry args={[kind === "computer" ? 0.55 : 0.85, 0.45]} />
          <meshStandardMaterial color="#516f82" />
        </mesh>
        <mesh position={[0, 0.28, -0.08]}>
          <boxGeometry args={[0.08, 0.15, 0.08]} />
          <meshStandardMaterial color="#454545" />
        </mesh>
      </group>
    );
  if (kind === "stove")
    return (
      <group>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.72, 0.64, 0.56]} />
          <meshStandardMaterial color="#d6d8d6" />
        </mesh>
        <mesh position={[0, 0.34, 0.29]}>
          <boxGeometry args={[0.51, 0.32, 0.02]} />
          <meshStandardMaterial color="#343c42" />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.65, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.11, 0.02, 4, 12]} />
            <meshStandardMaterial color="#262626" />
          </mesh>
        ))}
      </group>
    );
  if (kind === "toilet")
    return (
      <group>
        <mesh position={[0, 0.2, 0.1]}>
          <cylinderGeometry args={[0.26, 0.2, 0.4, 12]} />
          <meshStandardMaterial color="#f4f3ed" />
        </mesh>
        <mesh position={[0, 0.47, -0.18]}>
          <boxGeometry args={[0.52, 0.45, 0.2]} />
          <meshStandardMaterial color="#f4f3ed" />
        </mesh>
        <mesh position={[0, 0.42, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.045, 6, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
    );
  if (kind === "shower")
    return (
      <group>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.06, 16]} />
          <meshStandardMaterial color="#dce4e6" />
        </mesh>
        <mesh position={[-0.25, 0.62, -0.2]}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
          <meshStandardMaterial color="#abb7bc" />
        </mesh>
        <mesh position={[-0.1, 1.17, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.34, 8]} />
          <meshStandardMaterial color="#abb7bc" />
        </mesh>
        <mesh position={[0.04, 1.15, -0.2]}>
          <cylinderGeometry args={[0.15, 0.12, 0.04, 12]} />
          <meshStandardMaterial color="#abb7bc" />
        </mesh>
      </group>
    );
  if (kind === "plant")
    return (
      <group>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.24, 0.17, 0.36, 10]} />
          <meshStandardMaterial color="#b56d4f" />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.35, 10, 8]} />
          <meshStandardMaterial color="#46885a" />
        </mesh>
        <mesh position={[-0.16, 0.76, 0.03]}>
          <sphereGeometry args={[0.2, 8, 6]} />
          <meshStandardMaterial color="#5ca16a" />
        </mesh>
      </group>
    );
  if (kind === "light")
    return (
      <group>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 12]} />
          <meshStandardMaterial color="#72675e" />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.15, 8]} />
          <meshStandardMaterial color="#72675e" />
        </mesh>
        <mesh position={[0, 1.24, 0]}>
          <coneGeometry args={[0.32, 0.4, 12, 1, true]} />
          <meshStandardMaterial color="#f5dc9f" side={2} />
        </mesh>
      </group>
    );
  return (
    <mesh position={[0, 0.28, 0]}>
      <boxGeometry args={[0.62, 0.56, 0.52]} />
      <meshStandardMaterial color="#aa704b" roughness={1} />
    </mesh>
  );
}

function SlotObject({
  slot,
  placement,
  width,
  depth,
  editMode,
  onSelectPlacement,
  onSelectSlot,
}: {
  slot: HouseSlot;
  placement: HousePlacement | undefined;
  width: number;
  depth: number;
  editMode: boolean;
  onSelectPlacement: Props["onSelectPlacement"];
  onSelectSlot: Props["onSelectSlot"];
}) {
  const position: [number, number, number] = [
    (slot.x / 100 - 0.5) * (width - 0.8),
    0.2,
    (0.5 - slot.y / 100) * (depth - 0.8),
  ];
  if (!placement && !editMode) return null;
  const label = placement?.item_id.replaceAll("-", " ") ?? `Place in ${slot.slot_type} slot`;
  const artKey = placement?.art_key;
  const safeArtKey = artKey && /^[a-z0-9-]+$/i.test(artKey) ? artKey : null;
  return (
    <group position={position}>
      {placement ? (
        <group
          onClick={(event) => {
            event.stopPropagation();
            if (editMode) onSelectPlacement(placement);
          }}
        >
          <OptionalModel
            path={safeArtKey ? `/models/furniture/${safeArtKey}.glb` : ""}
            fallback={
              <FurnitureFallback artKey={safeArtKey ?? undefined} slotType={slot.slot_type} />
            }
          />
        </group>
      ) : (
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            onSelectSlot(slot);
          }}
        >
          <boxGeometry args={[0.48, 0.08, 0.48]} />
          <meshStandardMaterial color="#f6b34c" roughness={1} />
        </mesh>
      )}
      {editMode && (
        <Html center position={[0, 0.46, 0]} distanceFactor={10}>
          <button
            type="button"
            className="house-3d-slot-label"
            onClick={() => (placement ? onSelectPlacement(placement) : onSelectSlot(slot))}
          >
            {label}
          </button>
        </Html>
      )}
    </group>
  );
}

function LoadingProgress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="house-3d-loading" role="status">
      Loading room {Math.round(progress)}%
    </div>
  );
}

export function HouseRoom3D({
  houseTypeId,
  accessoryBand,
  slots,
  placements,
  editMode,
  onSelectPlacement,
  onSelectSlot,
}: Props) {
  const [width, depth] = ROOM_SIZE[houseTypeId] ?? ROOM_SIZE["shared-room"]!;
  const bySlot = useMemo(() => new Map(placements.map((item) => [item.slot, item])), [placements]);
  const modelPath = `/models/rooms/${/^[a-z0-9-]+$/i.test(houseTypeId) ? houseTypeId : "shared-room"}.glb`;
  return (
    <div className="house-3d-scene" aria-label={`${houseTypeId.replaceAll("-", " ")} 3D room`}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        shadows={false}
        camera={{
          position: [width * 0.75, Math.max(width, depth), depth * 0.85],
          fov: 42,
          near: 0.1,
          far: 80,
        }}
        gl={{ antialias: false, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#f2eadc"]} />
        <ambientLight intensity={1.2} />
        <directionalLight intensity={1.5} position={[5, 9, 6]} />
        <OptionalModel
          path={modelPath}
          tier={ACCESSORY_TIER[accessoryBand] ?? 1}
          fallback={<PlaceholderRoom width={width} depth={depth} />}
        />
        {slots.map((slot) => (
          <SlotObject
            key={slot.id}
            slot={slot}
            placement={bySlot.get(slot.id)}
            width={width}
            depth={depth}
            editMode={editMode}
            onSelectPlacement={onSelectPlacement}
            onSelectSlot={onSelectSlot}
          />
        ))}
        <OrbitControls
          enablePan={false}
          enableDamping={false}
          minDistance={Math.max(width, depth) * 0.75}
          maxDistance={Math.max(width, depth) * 2.5}
          minPolarAngle={0.35}
          maxPolarAngle={1.3}
          target={[0, 0, 0]}
        />
      </Canvas>
      <LoadingProgress />
    </div>
  );
}
