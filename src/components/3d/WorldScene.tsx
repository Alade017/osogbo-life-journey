import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Object3D, Vector3, type InstancedMesh, type PerspectiveCamera } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import {
  WORLD_CAMERA,
  WORLD_MATERIAL,
  WORLD_PALETTE,
  WORLD_SCALE,
  type WorldTone,
} from "./world-theme";

export function WorldMaterial({ tone = "wall", color }: { tone?: WorldTone; color?: string }) {
  return <meshStandardMaterial {...WORLD_MATERIAL} color={color ?? WORLD_PALETTE[tone]} />;
}

export function WorldLighting({ size = 30 }: { size?: number }) {
  return (
    <>
      <color attach="background" args={[WORLD_PALETTE.ground]} />
      <ambientLight intensity={1.4} />
      <directionalLight
        position={[size * 0.3, size, size * 0.4]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.001}
        shadow-normalBias={0.04}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-far={size * 3}
      />
      <ContactShadows
        position={[0, 0.015, 0]}
        scale={size * 2}
        opacity={0.28}
        blur={2.5}
        far={8}
        resolution={256}
        frames={Infinity}
        color={WORLD_PALETTE.timber}
      />
    </>
  );
}

/** Responsive framing is derived from scene extents, including portrait screens. */
export function WorldCamera({
  width,
  depth,
  stage = false,
  enabled = true,
  target,
  zoom = 1,
  polarAngle,
  onZoomChange,
  horizontalOrbit = false,
  verticalOrbit = false,
}: {
  width: number;
  depth: number;
  stage?: boolean;
  enabled?: boolean;
  target?: [number, number, number];
  zoom?: number;
  polarAngle?: number;
  onZoomChange?: (zoom: number) => void;
  horizontalOrbit?: boolean;
  verticalOrbit?: boolean;
}) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<Controls>(null);
  const aspect = size.width / Math.max(1, size.height);
  const framedWidth = stage ? (width + depth) / Math.SQRT2 : width;
  const distance =
    Math.max(depth, framedWidth / Math.min(aspect, 1.7), stage ? WORLD_SCALE.door * 2 : 0) * 1.55;
  const polar = polarAngle ?? (stage ? Math.PI / 4 : WORLD_CAMERA.polar);
  const azimuth = WORLD_CAMERA.azimuth;
  const [x, y, z] = target ?? [0, stage ? WORLD_SCALE.door * 0.65 : 0, 0];
  const framing = useRef<{ distance: number; polar: number; zoom: number } | null>(null);
  const offset = useMemo(() => new Vector3(), []);
  useLayoutEffect(() => {
    const previous = framing.current;
    const orbit = controls.current;
    const d = distance / Math.max(WORLD_CAMERA.minZoom, Math.min(WORLD_CAMERA.maxZoom, zoom));
    if (!previous || previous.distance !== distance || previous.polar !== polar || !orbit) {
      offset
        .set(
          Math.sin(azimuth) * Math.sin(polar),
          Math.cos(polar),
          Math.cos(azimuth) * Math.sin(polar),
        )
        .multiplyScalar(d);
    } else {
      // Follow by translating the existing orbit, preserving touch/wheel framing.
      offset.copy(camera.position).sub(orbit.target);
      if (previous.zoom !== zoom) offset.setLength(d);
    }
    camera.position.copy(offset);
    camera.position.x += x;
    camera.position.y += y;
    camera.position.z += z;
    framing.current = { distance, polar, zoom };
    camera.lookAt(x, y, z);
    const perspective = camera as PerspectiveCamera;
    perspective.fov = WORLD_CAMERA.fov;
    perspective.far = Math.max(200, distance * 4);
    perspective.updateProjectionMatrix();
    controls.current?.target.set(x, y, z);
    controls.current?.update();
    invalidate();
  }, [camera, distance, azimuth, polar, x, y, z, zoom, invalidate, offset]);
  return (
    <OrbitControls
      ref={controls}
      enabled={enabled}
      enablePan={false}
      enableDamping={false}
      enableRotate={!stage || horizontalOrbit || verticalOrbit}
      onEnd={() => {
        if (!controls.current || !onZoomChange) return;
        onZoomChange(
          Math.max(
            WORLD_CAMERA.minZoom,
            Math.min(WORLD_CAMERA.maxZoom, distance / controls.current.getDistance()),
          ),
        );
      }}
      minDistance={distance / WORLD_CAMERA.maxZoom}
      maxDistance={distance / WORLD_CAMERA.minZoom}
      minPolarAngle={verticalOrbit ? Math.max(0.35, polar - 0.35) : polar - (stage ? 0 : 0.08)}
      maxPolarAngle={verticalOrbit ? Math.min(1.25, polar + 0.35) : polar + (stage ? 0 : 0.08)}
      minAzimuthAngle={azimuth - (horizontalOrbit ? Math.PI / 3 : stage ? 0 : 0.14)}
      maxAzimuthAngle={azimuth + (horizontalOrbit ? Math.PI / 3 : stage ? 0 : 0.14)}
    />
  );
}

export type WorldInstance = {
  position: [number, number, number];
  scale?: [number, number, number];
  rotation?: number;
};
export function WorldInstances({
  items,
  tone,
  shape = "box",
  animate,
}: {
  items: readonly WorldInstance[];
  tone: WorldTone;
  shape?: "box" | "sphere";
  animate?: ((object: Object3D, index: number, seconds: number) => void) | undefined;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const { invalidate } = useThree();
  const animatedObject = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setInterval(invalidate, 1000 / 15);
    return () => window.clearInterval(timer);
  }, [animate, invalidate]);
  useFrame(({ clock }) => {
    if (!animate || !mesh.current) return;
    items.forEach((item, index) => {
      animatedObject.position.set(...item.position);
      animatedObject.scale.set(...(item.scale ?? [1, 1, 1]));
      animatedObject.rotation.set(0, item.rotation ?? 0, 0);
      animate(animatedObject, index, clock.elapsedTime);
      animatedObject.updateMatrix();
      mesh.current!.setMatrixAt(index, animatedObject.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  });
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new Object3D();
    items.forEach((item, index) => {
      object.position.set(...item.position);
      object.scale.set(...(item.scale ?? [1, 1, 1]));
      object.rotation.set(0, item.rotation ?? 0, 0);
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      {shape === "box" ? <boxGeometry /> : <sphereGeometry args={[0.5, 8, 6]} />}
      <WorldMaterial tone={tone} />
    </instancedMesh>
  );
}
export function WorldRoads({ items }: { items: readonly WorldInstance[] }) {
  return <WorldInstances items={items} tone="road" />;
}
export function WorldSidewalks({
  sidewalks,
  curbs,
}: {
  sidewalks: readonly WorldInstance[];
  curbs: readonly WorldInstance[];
}) {
  return (
    <>
      <WorldInstances items={sidewalks} tone="concrete" />
      <WorldInstances items={curbs} tone="slate" />
    </>
  );
}
export function WorldStreetLights({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const poleHeight = size * 1.35;

  return (
    <>
      {/* Vertical poles */}
      <WorldInstances
        tone="metal"
        items={positions.map(([x, z]) => ({
          position: [x, poleHeight / 2, z],
          scale: [size * 0.035, poleHeight, size * 0.035],
        }))}
      />

      {/* Horizontal arms */}
      <WorldInstances
        tone="metal"
        items={positions.map(([x, z]) => ({
          position: [x + size * 0.18, poleHeight * 0.91, z],
          scale: [size * 0.36, size * 0.035, size * 0.035],
        }))}
      />

      {/* Lamp heads */}
      <WorldInstances
        tone="linen"
        shape="sphere"
        items={positions.map(([x, z]) => ({
          position: [x + size * 0.34, poleHeight * 0.88, z],
          scale: [size * 0.12, size * 0.09, size * 0.12],
        }))}
      />
    </>
  );
}
export function WorldWasteBins({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  return (
    <>
      <WorldInstances
        tone="foliage"
        items={positions.map(([x, z]) => ({
          position: [x, size * 0.24, z],
          scale: [size * 0.32, size * 0.48, size * 0.32],
        }))}
      />
      <WorldInstances
        tone="slate"
        items={positions.map(([x, z]) => ({
          position: [x, size * 0.5, z],
          scale: [size * 0.38, size * 0.07, size * 0.38],
        }))}
      />
    </>
  );
}
export type WorldTree = {
  position: [number, number];
  height: number;
  canopyScale: number;
};

export function WorldTrees({ positions }: { positions: readonly WorldTree[] }) {
  const h = WORLD_SCALE.character;

  return (
    <>
      {/* Tree trunks */}
      <WorldInstances
        tone="timber"
        items={positions.map((tree) => ({
          position: [tree.position[0], h * tree.height * 0.47, tree.position[1]],
          scale: [h * 0.15, h * tree.height * 0.94, h * 0.15],
        }))}
      />

      {/* Tree canopies */}
      <WorldInstances
        tone="foliage"
        shape="sphere"
        items={positions.map((tree) => ({
          position: [tree.position[0], h * tree.height * 1.18, tree.position[1]],
          scale: [h * tree.canopyScale, h * tree.canopyScale * 1.12, h * tree.canopyScale],
        }))}
      />
    </>
  );
}
export function WorldPeople({
  positions,
  activities = [],
}: {
  positions: readonly [number, number][];
  activities?: readonly (string | undefined)[];
}) {
  const h = WORLD_SCALE.character;
  const active = activities.some((activity) => activity && activity !== "idle");
  return (
    <>
      <WorldInstances
        tone="slate"
        items={positions.map(([x, z]) => ({
          position: [x, h * 0.57, z],
          scale: [h * 0.27, h * 0.38, h * 0.2],
        }))}
      />
      <WorldInstances
        tone="timber"
        items={positions.flatMap(([x, z]) =>
          [-1, 1].map((side) => ({
            position: [x + side * h * 0.08, h * 0.19, z],
            scale: [h * 0.11, h * 0.38, h * 0.15],
          })),
        )}
      />
      <WorldInstances
        tone="clay"
        animate={
          active
            ? (object, index, seconds) => {
                const activity = activities[Math.floor(index / 2)];
                if (!activity || activity === "idle") return;
                const side = index % 2 ? 1 : -1;
                object.rotation.z = side * (0.4 + Math.sin(seconds * 3) * 0.2);
                object.position.y += h * 0.12;
              }
            : undefined
        }
        items={positions.flatMap(([x, z]) =>
          [-1, 1].map((side) => ({
            position: [x + side * h * 0.19, h * 0.52, z],
            scale: [h * 0.1, h * 0.4, h * 0.13],
          })),
        )}
      />
      <WorldInstances
        tone="clay"
        shape="sphere"
        items={positions.map(([x, z]) => ({
          position: [x, h * 0.85, z],
          scale: [h * 0.3, h * 0.3, h * 0.3],
        }))}
      />
    </>
  );
}

export function WorldHouse({
  position,
  width = WORLD_SCALE.door * 1.43,
  depth = WORLD_SCALE.door * 1.24,
  shop = false,
  detailed = false,
  rotation = 0,
  variant = "residential",
}: {
  position: [number, number, number];
  width?: number;
  depth?: number;
  shop?: boolean;
  detailed?: boolean;
  rotation?: number;
  variant?: string;
}) {
  const height = WORLD_SCALE.door * 1.4;

  const isMarket = variant === "market" || variant === "food";
  const isBank = variant === "bank";
  const isCivic = variant === "civic" || variant === "public-service";
  const isHealth = variant === "health" || variant === "clinic";
  const isSchool = variant === "school";
  const isWorship = variant === "worship";
  const isTransit = variant === "transit" || variant === "transport";
  const isSport = variant === "sport";
  const isClub = variant === "club";
  const isServices = variant === "services";

  const roofTone = isMarket ? "accent" : isWorship ? "clay" : isBank || isCivic ? "slate" : "roof";

  const accentTone = isHealth
    ? "foliage"
    : isSchool
      ? "sign"
      : isWorship
        ? "linen"
        : isTransit
          ? "accent"
          : "concrete";

  const windowCount = isBank || isCivic || isSchool ? 3 : 2;
  const windowPositions = Array.from(
    { length: windowCount },
    (_, index) => ((index - (windowCount - 1) / 2) * width) / (windowCount + 1),
  );

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Foundation */}
      <mesh position={[0, 0.09, 0]} receiveShadow castShadow>
        <boxGeometry args={[width + 0.16, 0.18, depth + 0.16]} />
        <WorldMaterial tone="concrete" />
      </mesh>

      {/* Main structure */}
      <mesh position={[0, height / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <WorldMaterial tone="wall" />
      </mesh>

      {/* Main roof */}
      <mesh position={[0, height + 0.31, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.32, 0.24, depth + 0.32]} />
        <WorldMaterial tone={roofTone} />
      </mesh>

      {/* Roof edge */}
      <mesh position={[0, height + 0.45, 0]}>
        <boxGeometry args={[width + 0.18, 0.07, depth + 0.18]} />
        <WorldMaterial tone="concrete" />
      </mesh>

      {/* Front entrance */}
      <mesh position={[0, WORLD_SCALE.door / 2 + 0.18, depth / 2 + 0.04]}>
        <boxGeometry args={[isMarket ? width * 0.48 : width * 0.3, WORLD_SCALE.door, 0.08]} />
        <WorldMaterial tone="timber" />
      </mesh>

      {/* Detailed windows */}
      {detailed &&
        windowPositions.map((x, index) => (
          <group key={`window-${index}`} position={[x, height * 0.65 + 0.18, depth / 2 + 0.045]}>
            <mesh>
              <boxGeometry args={[width * 0.2, height * 0.29, 0.08]} />
              <WorldMaterial tone="windowFrame" />
            </mesh>

            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[width * 0.16, height * 0.25, 0.025]} />
              <WorldMaterial tone="glass" />
            </mesh>

            <mesh position={[0, 0, 0.065]}>
              <boxGeometry args={[0.035, height * 0.25, 0.025]} />
              <WorldMaterial tone="metal" />
            </mesh>
          </group>
        ))}

      {/* MARKET AND FOOD BUILDINGS */}
      {isMarket && (
        <>
          <mesh position={[0, height * 0.84, depth / 2 + 0.32]} castShadow>
            <boxGeometry args={[width * 1.12, 0.17, 0.72]} />
            <WorldMaterial tone="accent" />
          </mesh>

          {[-1, 1].map((side) => (
            <mesh
              key={`market-support-${side}`}
              position={[side * width * 0.43, height * 0.65, depth / 2 + 0.28]}
            >
              <boxGeometry args={[0.07, height * 0.36, 0.07]} />
              <WorldMaterial tone="metal" />
            </mesh>
          ))}
        </>
      )}

      {/* BANK AND CIVIC BUILDINGS */}
      {(isBank || isCivic) &&
        [-1, 1].map((side) => (
          <mesh
            key={`column-${side}`}
            position={[side * width * 0.4, height * 0.45 + 0.18, depth / 2 + 0.08]}
            castShadow
          >
            <boxGeometry args={[0.16, height * 0.85, 0.18]} />
            <WorldMaterial tone="linen" />
          </mesh>
        ))}

      {/* HEALTH BUILDINGS */}
      {isHealth && (
        <mesh position={[0, height * 0.96, depth / 2 + 0.04]}>
          <boxGeometry args={[width * 0.55, 0.13, 0.08]} />
          <WorldMaterial tone="foliage" />
        </mesh>
      )}

      {/* SCHOOL AND LIBRARY BUILDINGS */}
      {(isSchool || isClub || isServices) && (
        <mesh position={[0, height + 0.55, 0]}>
          <boxGeometry args={[width * 0.72, 0.12, depth * 0.72]} />
          <WorldMaterial tone={accentTone} />
        </mesh>
      )}

      {/* WORSHIP BUILDINGS */}
      {isWorship && (
        <>
          <mesh position={[width * 0.3, height + 0.72, 0]}>
            <boxGeometry args={[0.22, 0.85, 0.22]} />
            <WorldMaterial tone="linen" />
          </mesh>

          <mesh position={[width * 0.3, height + 1.2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.2, 0.38, 4]} />
            <WorldMaterial tone="roof" />
          </mesh>
        </>
      )}

      {/* TRANSPORT BUILDINGS */}
      {isTransit && (
        <>
          <mesh position={[0, height * 0.88, depth / 2 + 0.48]}>
            <boxGeometry args={[width * 1.15, 0.12, 0.9]} />
            <WorldMaterial tone="accent" />
          </mesh>

          {[-1, 1].map((side) => (
            <mesh
              key={`transit-pillar-${side}`}
              position={[side * width * 0.42, height * 0.55, depth / 2 + 0.48]}
            >
              <boxGeometry args={[0.09, height * 0.65, 0.09]} />
              <WorldMaterial tone="metal" />
            </mesh>
          ))}
        </>
      )}

      {/* SPORTS AND RECREATION BUILDINGS */}
      {isSport && (
        <mesh position={[0, height + 0.55, 0]}>
          <boxGeometry args={[width * 0.55, 0.15, depth * 0.55]} />
          <WorldMaterial tone="foliage" />
        </mesh>
      )}

      {/* SHOPFRONT / BUILDING STEP */}
      {detailed && (
        <mesh position={[0, 0.13, depth / 2 + 0.2]} receiveShadow>
          <boxGeometry args={[width * 0.55, 0.16, 0.38]} />
          <WorldMaterial tone="concrete" />
        </mesh>
      )}
    </group>
  );
}
