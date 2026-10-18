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
  placement?: HousePlacement;
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
        <group onClick={(event) => { event.stopPropagation(); if (editMode) onSelectPlacement(placement); }}>
          <OptionalModel
            path={safeArtKey ? `/models/furniture/${safeArtKey}.glb` : ""}
            fallback={
              <mesh>
                <boxGeometry args={[0.58, 0.42, 0.58]} />
                <meshStandardMaterial color="#aa704b" roughness={1} />
              </mesh>
            }
          />
        </group>
      ) : (
        <mesh onClick={(event) => { event.stopPropagation(); onSelectSlot(slot); }}>
          <boxGeometry args={[0.48, 0.08, 0.48]} />
          <meshStandardMaterial color="#f6b34c" roughness={1} />
        </mesh>
      )}
      {editMode && (
        <Html center position={[0, 0.46, 0]} distanceFactor={10}>
          <button
            type="button"
            className="house-3d-slot-label"
            onClick={() => placement ? onSelectPlacement(placement) : onSelectSlot(slot)}
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
  return <div className="house-3d-loading" role="status">Loading room {Math.round(progress)}%</div>;
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
        dpr={[1, 1.5]}
        shadows={false}
        camera={{ position: [width * 0.75, Math.max(width, depth), depth * 0.85], fov: 42, near: 0.1, far: 80 }}
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
