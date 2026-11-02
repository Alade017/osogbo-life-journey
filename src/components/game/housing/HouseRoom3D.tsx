import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Plane, Vector3, type Group } from "three";
import type { HousePlacement, HouseSlot } from "./HouseRoomScene";
import {
  HOUSE_ROOM_SIZE as ROOM_SIZE,
  HOUSE_ACCESSORY_TIER as ACCESSORY_TIER,
  houseSlotPosition as slotPosition,
  type HouseRoomRendererProps as Props,
} from "./house-room-contract";

const DRACO_PATH = "/models/draco/";

type DragPreview = { placementId: string; x: number; z: number; targetSlotId: string | null };
type DragPointer = {
  placement: HousePlacement;
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
};
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), -0.2);

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

function OsogboRoomPrototype({ width, depth }: { width: number; depth: number }) {
  const floorTileCountX = Math.max(4, Math.floor(width / 0.9));
  const floorTileCountZ = Math.max(4, Math.floor(depth / 0.9));
  return (
    <group>
      <mesh position={[0, -0.23, 0]}>
        <boxGeometry args={[width + 0.7, 0.22, depth + 0.7]} />
        <meshStandardMaterial color="#766044" roughness={1} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[width, 0.16, depth]} />
        <meshStandardMaterial color="#d9c6a6" roughness={1} />
      </mesh>
      {Array.from({ length: floorTileCountX - 1 }, (_, index) => {
        const x = -width / 2 + (width * (index + 1)) / floorTileCountX;
        return (
          <mesh key={`floor-x-${index}`} position={[x, 0.006, 0]}>
            <boxGeometry args={[0.018, 0.012, depth - 0.06]} />
            <meshStandardMaterial color="#c8b18d" roughness={1} />
          </mesh>
        );
      })}
      {Array.from({ length: floorTileCountZ - 1 }, (_, index) => {
        const z = -depth / 2 + (depth * (index + 1)) / floorTileCountZ;
        return (
          <mesh key={`floor-z-${index}`} position={[0, 0.006, z]}>
            <boxGeometry args={[width - 0.06, 0.012, 0.018]} />
            <meshStandardMaterial color="#c8b18d" roughness={1} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.018, depth * 0.18]}>
        <boxGeometry args={[width * 0.45, 0.025, depth * 0.4]} />
        <meshStandardMaterial color="#263d66" roughness={1} />
      </mesh>
      <mesh position={[0, 0.034, depth * 0.18]}>
        <boxGeometry args={[width * 0.4, 0.012, depth * 0.35]} />
        <meshStandardMaterial color="#bd8b45" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`textile-diamond-${side}`}
          position={[side * width * 0.105, 0.045, depth * 0.18]}
          rotation={[0, Math.PI / 4, 0]}
        >
          <boxGeometry args={[0.28, 0.014, 0.28]} />
          <meshStandardMaterial color="#263d66" roughness={1} />
        </mesh>
      ))}
      <mesh position={[-width / 2, 0.66, 0]}>
        <boxGeometry args={[0.16, 1.32, depth]} />
        <meshStandardMaterial color="#9b5638" roughness={1} />
      </mesh>
      <mesh position={[-width / 2 + 0.09, 0.22, 0]}>
        <boxGeometry args={[0.025, 0.09, depth - 0.12]} />
        <meshStandardMaterial color="#d6aa59" roughness={1} />
      </mesh>
      <mesh position={[0, 0.66, -depth / 2]}>
        <boxGeometry args={[width, 1.32, 0.16]} />
        <meshStandardMaterial color="#ead9bd" roughness={1} />
      </mesh>
      <mesh position={[0, 0.17, -depth / 2 + 0.09]}>
        <boxGeometry args={[width, 0.18, 0.035]} />
        <meshStandardMaterial color="#47715c" roughness={1} />
      </mesh>
      <mesh position={[0, 0.27, -depth / 2 + 0.11]}>
        <boxGeometry args={[width, 0.025, 0.035]} />
        <meshStandardMaterial color="#d5a656" roughness={1} />
      </mesh>
      {width >= 5 && (
        <group position={[-width * 0.2, 0.82, -depth / 2 + 0.105]}>
          <mesh>
            <boxGeometry args={[1.3, 0.82, 0.08]} />
            <meshStandardMaterial color="#74503a" roughness={1} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[1.16, 0.68, 0.035]} />
            <meshStandardMaterial color="#83b9b1" roughness={1} />
          </mesh>
          {[-0.38, 0, 0.38].map((x) => (
            <mesh key={`window-bar-${x}`} position={[x, 0, 0.08]}>
              <boxGeometry args={[0.035, 0.68, 0.025]} />
              <meshStandardMaterial color="#f0d7a4" roughness={1} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[1.16, 0.035, 0.025]} />
            <meshStandardMaterial color="#f0d7a4" roughness={1} />
          </mesh>
        </group>
      )}
      {width >= 5 && (
        <group position={[width * 0.27, 0.82, -depth / 2 + 0.11]}>
          <mesh>
            <boxGeometry args={[0.68, 0.78, 0.06]} />
            <meshStandardMaterial color="#875b3d" roughness={1} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.56, 0.66, 0.025]} />
            <meshStandardMaterial color="#263d66" roughness={1} />
          </mesh>
          {[-0.2, 0, 0.2].map((y) => (
            <mesh key={`wall-motif-${y}`} position={[0, y, 0.06]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.1, 0.1, 0.018]} />
              <meshStandardMaterial color="#d9aa5c" roughness={1} />
            </mesh>
          ))}
        </group>
      )}
      {width >= 8 && (
        <group position={[width * 0.12, 0.93, -depth / 2 + 0.1]}>
          {[-0.2, 0, 0.2].map((x) => (
            <mesh key={`vent-${x}`} position={[x, 0, 0]}>
              <boxGeometry args={[0.12, 0.13, 0.035]} />
              <meshStandardMaterial color="#b88b5d" roughness={1} />
            </mesh>
          ))}
        </group>
      )}
      {width >= 6 && (
        <group position={[width * 0.15, 0.37, -depth * 0.04]}>
          <mesh>
            <boxGeometry args={[0.12, 0.74, depth * 0.55]} />
            <meshStandardMaterial color="#76533b" roughness={1} />
          </mesh>
          <mesh position={[0.07, 0, 0]}>
            <boxGeometry args={[0.025, 0.62, depth * 0.48]} />
            <meshStandardMaterial color="#d6aa59" roughness={1} />
          </mesh>
        </group>
      )}
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
      <group>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.95, 0.18, 1.35]} />
          <meshStandardMaterial color="#81543a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <boxGeometry args={[0.88, 0.12, 1.22]} />
          <meshStandardMaterial color="#f0e5cf" roughness={1} />
        </mesh>
        <mesh position={[0, 0.48, -0.66]}>
          <boxGeometry args={[0.98, 0.62, 0.1]} />
          <meshStandardMaterial color="#60432f" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.35, 0.43]}>
          <boxGeometry args={[0.87, 0.035, 0.27]} />
          <meshStandardMaterial color="#263d66" roughness={1} />
        </mesh>
        {[-0.23, 0.23].map((x) => (
          <mesh key={`bed-textile-${x}`} position={[x, 0.38, 0.43]}>
            <boxGeometry args={[0.07, 0.04, 0.29]} />
            <meshStandardMaterial color="#d8ac5e" roughness={1} />
          </mesh>
        ))}
        <mesh position={[-0.23, 0.36, -0.4]}>
          <boxGeometry args={[0.36, 0.07, 0.25]} />
          <meshStandardMaterial color="#fffaf0" roughness={1} />
        </mesh>
        <mesh position={[0.23, 0.36, -0.4]}>
          <boxGeometry args={[0.36, 0.07, 0.25]} />
          <meshStandardMaterial color="#fffaf0" roughness={1} />
        </mesh>
      </group>
    );
  if (["sofa", "sofa-2", "seat"].includes(kind))
    return (
      <group>
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[1.15, 0.34, 0.54]} />
          <meshStandardMaterial color="#315d58" roughness={1} />
        </mesh>
        <mesh position={[0, 0.54, -0.24]}>
          <boxGeometry args={[1.15, 0.52, 0.14]} />
          <meshStandardMaterial color="#244943" roughness={1} />
        </mesh>
        <mesh position={[-0.54, 0.43, 0]}>
          <boxGeometry args={[0.12, 0.44, 0.65]} />
          <meshStandardMaterial color="#244943" roughness={1} />
        </mesh>
        <mesh position={[0.54, 0.43, 0]}>
          <boxGeometry args={[0.12, 0.44, 0.65]} />
          <meshStandardMaterial color="#244943" roughness={1} />
        </mesh>
        {[-0.3, 0, 0.3].map((x, index) => (
          <mesh key={`sofa-cushion-${x}`} position={[x, 0.53, -0.13]}>
            <boxGeometry args={[0.23, 0.24, 0.09]} />
            <meshStandardMaterial color={index === 1 ? "#d29a4d" : "#b85f3e"} roughness={1} />
          </mesh>
        ))}
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
          <meshStandardMaterial color="#c7b9a2" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.34, 0.29]}>
          <boxGeometry args={[0.51, 0.32, 0.02]} />
          <meshStandardMaterial color="#4b4037" roughness={0.8} />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.65, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.11, 0.02, 4, 12]} />
            <meshStandardMaterial color="#403a34" roughness={0.8} />
          </mesh>
        ))}
        <group position={[0, 0.72, -0.08]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.21, 0.17, 0.3, 12]} />
            <meshStandardMaterial color="#8b4e35" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.045, 12]} />
            <meshStandardMaterial color="#68402f" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshStandardMaterial color="#bd9150" roughness={0.8} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={`pot-handle-${side}`} position={[side * 0.22, 0.22, 0]}>
              <torusGeometry args={[0.055, 0.018, 5, 10]} />
              <meshStandardMaterial color="#68402f" roughness={0.8} />
            </mesh>
          ))}
        </group>
      </group>
    );
  if (kind === "pot" || kind === "cooking-pot")
    return (
      <group>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.29, 0.22, 0.4, 12]} />
          <meshStandardMaterial color="#8b4e35" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.43, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 12]} />
          <meshStandardMaterial color="#68402f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color="#bd9150" roughness={0.8} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={`pot-handle-${side}`} position={[side * 0.29, 0.27, 0]}>
            <torusGeometry args={[0.07, 0.02, 5, 10]} />
            <meshStandardMaterial color="#68402f" roughness={0.85} />
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
  if (kind === "wardrobe")
    return (
      <group>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.92, 1.4, 0.48]} />
          <meshStandardMaterial color="#78503a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.69, 0.25]}>
          <boxGeometry args={[0.78, 1.17, 0.025]} />
          <meshStandardMaterial color="#8c6042" roughness={0.85} />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={`wardrobe-inlay-${x}`} position={[x, 0.69, 0.27]}>
            <boxGeometry args={[0.035, 1.02, 0.015]} />
            <meshStandardMaterial color="#c59a57" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 0.2, 0.27]}>
          <boxGeometry args={[0.82, 0.035, 0.02]} />
          <meshStandardMaterial color="#263d66" roughness={1} />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.72, 0.25]}>
            <boxGeometry args={[0.035, 0.13, 0.025]} />
            <meshStandardMaterial color="#dfbd79" metalness={0.25} roughness={0.55} />
          </mesh>
        ))}
      </group>
    );
  if (kind === "coffee-table")
    return (
      <group>
        <mesh position={[0, 0.43, 0]}>
          <boxGeometry args={[1.05, 0.1, 0.65]} />
          <meshStandardMaterial color="#9b6a43" />
        </mesh>
        {[-0.42, 0.42].flatMap((x) =>
          [-0.23, 0.23].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.22, z]}>
              <boxGeometry args={[0.08, 0.4, 0.08]} />
              <meshStandardMaterial color="#6b4935" />
            </mesh>
          )),
        )}
      </group>
    );
  if (kind === "wall-art")
    return (
      <group>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.76, 0.62, 0.045]} />
          <meshStandardMaterial color="#6e4935" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.7, 0.03]}>
          <planeGeometry args={[0.65, 0.5]} />
          <meshStandardMaterial color="#263d66" roughness={1} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={`wall-art-motif-${side}`}
            position={[side * 0.14, 0.7, 0.045]}
            rotation={[0, 0, Math.PI / 4]}
          >
            <boxGeometry args={[0.12, 0.12, 0.02]} />
            <meshStandardMaterial color="#d5a656" roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, 0.05]}>
          <boxGeometry args={[0.035, 0.35, 0.02]} />
          <meshStandardMaterial color="#b85f3e" roughness={1} />
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
  const position = slotPosition(slot, width, depth);
  const moving = placement && dragPreview?.placementId === placement.id;
  const displayPosition: [number, number, number] = moving
    ? [dragPreview.x, 0.2, dragPreview.z]
    : position;
  if (!placement && !editMode) return null;
  const label = placement?.item_id.replaceAll("-", " ") ?? `Place in ${slot.slot_type} slot`;
  const artKey = placement?.art_key;
  const safeArtKey = artKey && /^[a-z0-9-]+$/i.test(artKey) ? artKey : null;
  return (
    <group position={displayPosition}>
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
            if (!inputBlocked) onSelectSlot(slot);
          }}
        >
          <boxGeometry args={[0.48, 0.08, 0.48]} />
          <meshStandardMaterial
            color={
              dragPreview?.targetSlotId === slot.id
                ? "#44c78b"
                : activeSlotType === slot.slot_type
                  ? "#59b9dc"
                  : "#f6b34c"
            }
            roughness={1}
          />
        </mesh>
      )}
      {editMode && (
        <Html center position={[0, 0.46, 0]} distanceFactor={10}>
          <button
            type="button"
            className="house-3d-slot-label"
            aria-label={label}
            title={label}
            disabled={inputBlocked}
            onClick={() => (placement ? onSelectPlacement(placement) : onSelectSlot(slot))}
          >
            {placement ? "•••" : "+"}
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
  inputBlocked = false,
  houseTypeId,
  accessoryBand,
  slots,
  placements,
  editMode,
  moveEnabled,
  onSelectPlacement,
  onSelectSlot,
  onMove,
}: Props & { inputBlocked?: boolean }) {
  const [width, depth] = ROOM_SIZE[houseTypeId] ?? ROOM_SIZE["shared-room"]!;
  const bySlot = useMemo(() => new Map(placements.map((item) => [item.slot, item])), [placements]);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragPointer = useRef<DragPointer | null>(null);
  const suppressClickId = useRef<string | null>(null);
  const dragTarget = (placement: HousePlacement, x: number, z: number) => {
    const radius = Math.max(0.62, Math.min(width, depth) * 0.16);
    return (
      slots
        .filter((slot) => slot.slot_type === placement.slot_type && !bySlot.has(slot.id))
        .map((slot) => {
          const [sx, , sz] = slotPosition(slot, width, depth);
          return { slot, distance: Math.hypot(sx - x, sz - z) };
        })
        .filter((candidate) => candidate.distance <= radius)
        .sort((a, b) => a.distance - b.distance)[0]?.slot ?? null
    );
  };
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
      const [x, , z] = slotPosition(original, width, depth);
      setDragPreview({ placementId: placement.id, x, z, targetSlotId: null });
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
    const x = Math.max(-width / 2, Math.min(width / 2, point.x));
    const z = Math.max(-depth / 2, Math.min(depth / 2, point.z));
    setDragPreview({
      placementId: pointer.placement.id,
      x,
      z,
      targetSlotId: dragTarget(pointer.placement, point.x, point.z)?.id ?? null,
    });
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
    const destination = point && dragTarget(pointer.placement, point.x, point.z);
    if (destination) onMove(pointer.placement, destination);
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
        <color attach="background" args={["#d7e8e5"]} />
        <ambientLight intensity={1.2} />
        <directionalLight intensity={1.5} position={[5, 9, 6]} />
        <OptionalModel
          path={modelPath}
          tier={ACCESSORY_TIER[accessoryBand] ?? 1}
          fallback={<OsogboRoomPrototype width={width} depth={depth} />}
        />
        {slots.map((slot) => (
          <SlotObject
            key={slot.id}
            slot={slot}
            placement={bySlot.get(slot.id)}
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
                : null
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
        <OrbitControls
          enabled={!inputBlocked && !dragPreview}
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
      {editMode && (
        <div className="house-3d-arrange-hint" role="status">
          {dragPreview
            ? dragPreview.targetSlotId
              ? `Release to move to ${dragPreview.targetSlotId.replaceAll("-", " ")}`
              : "Move over a blue spot, or release to cancel"
            : moveEnabled
              ? "Drag an accessory to a blue spot"
              : "Finish saving before moving another accessory"}
        </div>
      )}
    </div>
  );
}
