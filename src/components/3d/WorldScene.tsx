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
export function WorldTrees({ positions }: { positions: readonly [number, number][] }) {
  const h = WORLD_SCALE.character;
  return (
    <>
      <WorldInstances
        tone="timber"
        items={positions.map(([x, z]) => ({
          position: [x, h * 0.47, z],
          scale: [h * 0.15, h * 0.94, h * 0.15],
        }))}
      />
      <WorldInstances
        tone="foliage"
        shape="sphere"
        items={positions.map(([x, z]) => ({
          position: [x, h * 1.18, z],
          scale: [h * 1.06, h * 1.18, h * 1.06],
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
}: {
  position: [number, number, number];
  width?: number;
  depth?: number;
  shop?: boolean;
  detailed?: boolean;
  rotation?: number;
}) {
  const height = WORLD_SCALE.door * 1.4;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <WorldMaterial />
      </mesh>
      <mesh position={[0, height + 0.12, 0]} castShadow>
        <boxGeometry args={[width + 0.2, 0.24, depth + 0.2]} />
        <WorldMaterial tone={shop ? "slate" : "clay"} />
      </mesh>
      <mesh position={[0, WORLD_SCALE.door / 2, depth / 2 + 0.015]}>
        <boxGeometry args={[shop ? width * 0.65 : 0.85, WORLD_SCALE.door, 0.04]} />
        <WorldMaterial tone="timber" />
      </mesh>
      {detailed && (
        <>
          <WorldInstances
            tone="linen"
            items={[-1, 1].map((side) => ({
              position: [side * width * 0.32, height * 0.64, depth / 2 + 0.04],
              scale: [width * 0.21, 0.75, 0.06],
            }))}
          />
          <WorldInstances
            tone="slate"
            items={[-1, 1].map((side) => ({
              position: [side * width * 0.32, height * 0.64, depth / 2 + 0.08],
              scale: [width * 0.17, 0.61, 0.025],
            }))}
          />
          {shop && (
            <mesh position={[0, height * 0.84, depth / 2 + 0.3]} castShadow>
              <boxGeometry args={[width * 1.06, 0.15, 0.75]} />
              <WorldMaterial tone="foliage" />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
