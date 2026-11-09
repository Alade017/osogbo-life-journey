import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { CanvasLabel } from "@/components/3d/CanvasLabel";
import { Object3D, Vector3, type InstancedMesh, type PerspectiveCamera, type Texture } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import {
  WORLD_CAMERA,
  WORLD_MATERIAL,
  WORLD_PALETTE,
  WORLD_SCALE,
  type WorldTone,
} from "./world-theme";

export function WorldMaterial({
  tone = "wall",
  color,
  map,
}: {
  tone?: WorldTone;
  color?: string;
  map?: Texture | null;
}) {
  return (
    <meshStandardMaterial
      {...WORLD_MATERIAL}
      color={color ?? WORLD_PALETTE[tone]}
      map={map ?? null}
    />
  );
}

export function WorldLighting({ size = 30, dimmed = false }: { size?: number; dimmed?: boolean }) {
  return (
    <>
      <color attach="background" args={[WORLD_PALETTE.ground]} />
      <ambientLight intensity={dimmed ? 0.5 : 1.4} />
      <directionalLight
        position={[size * 0.3, size, size * 0.4]}
        intensity={dimmed ? 0.7 : 2}
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
<<<<<<< HEAD
  distanceScale = 1,
=======
  freeExplore = false,
>>>>>>> 824ebadba4d1006731a338ac27771f07db84357a
}: {
  width: number;
  depth: number;
  stage?: boolean;
  enabled?: boolean;
  target?: [number, number, number] | undefined;
  zoom?: number;
  polarAngle?: number;
  onZoomChange?: (zoom: number) => void;
  horizontalOrbit?: boolean;
  verticalOrbit?: boolean;
<<<<<<< HEAD
  /** Scales the camera distance past the zoom clamp, for close-up framing. */
  distanceScale?: number;
=======
  freeExplore?: boolean;
>>>>>>> 824ebadba4d1006731a338ac27771f07db84357a
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
  const framing = useRef<{ distance: number; polar: number; d: number } | null>(null);
  const offset = useMemo(() => new Vector3(), []);
  useLayoutEffect(() => {
    const previous = framing.current;
    const orbit = controls.current;
    const d =
      (distance / Math.max(WORLD_CAMERA.minZoom, Math.min(WORLD_CAMERA.maxZoom, zoom))) *
      distanceScale;
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
      if (previous.d !== d) offset.setLength(d);
    }
    camera.position.copy(offset);
    camera.position.x += x;
    camera.position.y += y;
    camera.position.z += z;
    framing.current = { distance, polar, d };
    camera.lookAt(x, y, z);
    const perspective = camera as PerspectiveCamera;
    perspective.fov = WORLD_CAMERA.fov;
    perspective.far = Math.max(200, distance * 4);
    perspective.updateProjectionMatrix();
    controls.current?.target.set(x, y, z);
    controls.current?.update();
    invalidate();
  }, [camera, distance, azimuth, polar, x, y, z, zoom, distanceScale, invalidate, offset]);
  return (
    <OrbitControls
      ref={controls}
      enabled={enabled}
      enablePan={freeExplore}
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
      minPolarAngle={freeExplore ? 0.35 : verticalOrbit ? Math.max(0.35, polar - 0.35) : polar - (stage ? 0 : 0.08)}
      maxPolarAngle={freeExplore ? 1.25 : verticalOrbit ? Math.min(1.25, polar + 0.35) : polar + (stage ? 0 : 0.08)}
      minAzimuthAngle={freeExplore ? -Infinity : azimuth - (horizontalOrbit ? Math.PI / 3 : stage ? 0 : 0.14)}
      maxAzimuthAngle={freeExplore ? Infinity : azimuth + (horizontalOrbit ? Math.PI / 3 : stage ? 0 : 0.14)}
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
  color,
  shape = "box",
  animate,
}: {
  items: readonly WorldInstance[];
  tone: WorldTone;
  /** Optional colour that replaces the tone's palette colour for these instances. */
  color?: string;
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
      <WorldMaterial tone={tone} {...(color ? { color } : {})} />
    </instancedMesh>
  );
}
export function WorldRoads({ items }: { items: readonly WorldInstance[] }) {
  return <WorldInstances items={items} tone="road" />;
}
export function WorldRoadMarkings({ items }: { items: readonly WorldInstance[] }) {
  return <WorldInstances items={items} tone="linen" />;
}
export function WorldPedestrianCrossings({ items }: { items: readonly WorldInstance[] }) {
  return <WorldInstances items={items} tone="linen" />;
}
export function WorldTrafficLights({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const poleHeight = size * 1.15;

  return (
    <>
      {positions.map(([x, z], index) => (
        <group key={`traffic-light-${index}`} position={[x, 0, z]}>
          {/* Vertical pole */}
          <mesh position={[0, poleHeight / 2, 0]} castShadow>
            <boxGeometry args={[size * 0.045, poleHeight, size * 0.045]} />
            <WorldMaterial tone="metal" />
          </mesh>

          {/* Signal housing */}
          <mesh position={[0, poleHeight * 0.85, 0]} castShadow>
            <boxGeometry args={[size * 0.19, size * 0.42, size * 0.13]} />
            <WorldMaterial tone="slate" />
          </mesh>

          {/* Red signal */}
          <mesh position={[0, poleHeight * 0.96, size * 0.071]}>
            <sphereGeometry args={[size * 0.045, 8, 8]} />
            <WorldMaterial tone="clay" />
          </mesh>

          {/* Amber signal */}
          <mesh position={[0, poleHeight * 0.85, size * 0.071]}>
            <sphereGeometry args={[size * 0.045, 8, 8]} />
            <WorldMaterial tone="linen" />
          </mesh>

          {/* Green signal */}
          <mesh position={[0, poleHeight * 0.74, size * 0.071]}>
            <sphereGeometry args={[size * 0.045, 8, 8]} />
            <WorldMaterial tone="foliage" />
          </mesh>
        </group>
      ))}
    </>
  );
}
export function WorldCars({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const bodyColors = ["#c94b36", "#e3b542", "#276b9a", "#43845c"];

  const length = size * 0.82;
  const width = size * 0.42;
  const bodyHeight = size * 0.18;
  const wheelRadius = size * 0.095;

  return (
    <>
      {positions.map(([x, z], index) => {
        const bodyColor = bodyColors[index % bodyColors.length] ?? "#c94b36";

        return (
          <group key={`car-${index}`} position={[x, 0, z]}>
            {/* Main vehicle body */}
            <mesh position={[0, size * 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, bodyHeight, width]} />
              <WorldMaterial tone="concrete" color={bodyColor} />
            </mesh>

            {/* Raised cabin */}
            <mesh position={[-size * 0.015, size * 0.39, 0]} castShadow>
              <boxGeometry args={[length * 0.48, size * 0.22, width * 0.76]} />
              <WorldMaterial tone="linen" />
            </mesh>

            {/* Side windows */}
            {[-1, 1].map((side) => (
              <mesh key={`window-${side}`} position={[0, size * 0.4, side * width * 0.39]}>
                <boxGeometry args={[length * 0.35, size * 0.12, size * 0.012]} />
                <WorldMaterial tone="glass" />
              </mesh>
            ))}

            {/* Front windscreen */}
            <mesh position={[length * 0.245, size * 0.4, 0]}>
              <boxGeometry args={[size * 0.012, size * 0.13, width * 0.62]} />
              <WorldMaterial tone="glass" />
            </mesh>

            {/* Rear windscreen */}
            <mesh position={[-length * 0.245, size * 0.4, 0]}>
              <boxGeometry args={[size * 0.012, size * 0.12, width * 0.62]} />
              <WorldMaterial tone="glass" />
            </mesh>

            {/* Four wheels */}
            {[-1, 1].flatMap((sideX) =>
              [-1, 1].map((sideZ) => (
                <mesh
                  key={`wheel-${sideX}-${sideZ}`}
                  position={[
                    sideX * length * 0.29,
                    wheelRadius + size * 0.035,
                    sideZ * width * 0.51,
                  ]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[wheelRadius, wheelRadius, size * 0.07, 10]} />
                  <WorldMaterial tone="slate" />
                </mesh>
              )),
            )}

            {/* Front headlights — vehicle faces +X */}
            {[-1, 1].map((side) => (
              <mesh
                key={`headlight-${side}`}
                position={[length * 0.49, size * 0.22, side * width * 0.3]}
              >
                <boxGeometry args={[size * 0.025, size * 0.055, size * 0.075]} />
                <WorldMaterial tone="linen" />
              </mesh>
            ))}

            {/* Rear lights */}
            {[-1, 1].map((side) => (
              <mesh
                key={`taillight-${side}`}
                position={[-length * 0.49, size * 0.22, side * width * 0.3]}
              >
                <boxGeometry args={[size * 0.025, size * 0.055, size * 0.075]} />
                <WorldMaterial tone="clay" />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
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
export function WorldBusStops({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const roofHeight = size * 0.95;
  const shelterWidth = size * 1.15;
  const shelterDepth = size * 0.65;

  return (
    <>
      {positions.map(([x, z], index) => (
        <group key={`bus-stop-${index}`} position={[x, 0, z]}>
          {/* Shelter roof */}
          <mesh position={[0, roofHeight, 0]} castShadow>
            <boxGeometry args={[shelterWidth, size * 0.12, shelterDepth]} />
            <WorldMaterial tone="accent" />
          </mesh>

          {/* Four support pillars */}
          {[-1, 1].flatMap((sideX) =>
            [-1, 1].map((sideZ) => (
              <mesh
                key={`pillar-${sideX}-${sideZ}`}
                position={[
                  sideX * shelterWidth * 0.43,
                  roofHeight * 0.48,
                  sideZ * shelterDepth * 0.4,
                ]}
                castShadow
              >
                <boxGeometry args={[size * 0.055, roofHeight * 0.96, size * 0.055]} />
                <WorldMaterial tone="metal" />
              </mesh>
            )),
          )}

          {/* Rear shelter panel */}
          <mesh position={[0, roofHeight * 0.48, -shelterDepth * 0.4]}>
            <boxGeometry args={[shelterWidth * 0.82, roofHeight * 0.85, size * 0.045]} />
            <WorldMaterial tone="concrete" />
          </mesh>

          {/* Passenger bench */}
          <mesh position={[0, size * 0.29, -shelterDepth * 0.2]}>
            <boxGeometry args={[shelterWidth * 0.62, size * 0.07, size * 0.2]} />
            <WorldMaterial tone="timber" />
          </mesh>

          {/* Bus stop sign pole */}
          <mesh position={[shelterWidth * 0.58, roofHeight * 0.5, shelterDepth * 0.15]}>
            <boxGeometry args={[size * 0.035, roofHeight, size * 0.035]} />
            <WorldMaterial tone="metal" />
          </mesh>

          {/* Bus stop sign */}
          <mesh position={[shelterWidth * 0.58, roofHeight * 0.88, shelterDepth * 0.15]}>
            <boxGeometry args={[size * 0.3, size * 0.24, size * 0.07]} />
            <WorldMaterial tone="sign" />
          </mesh>
        </group>
      ))}
    </>
  );
}
type RoadSign = {
  position: [number, number];
  destination: string;
  direction: "left" | "right";
};

export function WorldRoadSigns({
  positions,
  size,
}: {
  positions: readonly RoadSign[];
  size: number;
}) {
  const poleHeight = size * 1.15;
  const boardWidth = size * 1.05;
  const boardHeight = size * 0.28;

  return (
    <>
      {positions.map((sign, index) => {
        const arrowRotation = sign.direction === "right" ? -Math.PI / 2 : Math.PI / 2;

        return (
          <group key={`road-sign-${index}`} position={[sign.position[0], 0, sign.position[1]]}>
            {/* Metal support pole */}
            <mesh position={[0, poleHeight / 2, 0]} castShadow>
              <boxGeometry args={[size * 0.045, poleHeight, size * 0.045]} />
              <WorldMaterial tone="metal" />
            </mesh>

            {/* Directional sign panel */}
            <mesh position={[0, poleHeight * 0.78, 0]} castShadow>
              <boxGeometry args={[boardWidth, boardHeight, size * 0.075]} />
              <WorldMaterial tone="foliage" />
            </mesh>

            {/* Destination label */}
            <CanvasLabel
              position={[-size * 0.13, poleHeight * 0.78, size * 0.041]}
              fontSize={size * 0.105}
              text={sign.destination}
            />

            {/* Arrow shaft */}
            <mesh position={[size * 0.38, poleHeight * 0.78, size * 0.045]}>
              <boxGeometry args={[size * 0.16, size * 0.035, size * 0.025]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Arrow head */}
            <mesh
              position={[size * 0.46, poleHeight * 0.78, size * 0.045]}
              rotation={[0, 0, arrowRotation]}
            >
              <coneGeometry args={[size * 0.085, size * 0.13, 3]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
export function WorldRoadsideShops({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const shopWidth = size * 0.85;
  const shopDepth = size * 0.75;
  const wallHeight = size * 0.65;

  return (
    <>
      {positions.map(([x, z], index) => (
        <group key={`roadside-shop-${index}`} position={[x, 0, z]}>
          {/* Shop floor */}
          <mesh position={[0, size * 0.025, 0]} receiveShadow>
            <boxGeometry args={[shopWidth, size * 0.05, shopDepth]} />
            <WorldMaterial tone="concrete" />
          </mesh>

          {/* Left wall */}
          <mesh position={[-shopWidth * 0.46, wallHeight / 2, 0]} castShadow>
            <boxGeometry args={[size * 0.07, wallHeight, shopDepth]} />
            <WorldMaterial tone="clay" />
          </mesh>

          {/* Right wall */}
          <mesh position={[shopWidth * 0.46, wallHeight / 2, 0]} castShadow>
            <boxGeometry args={[size * 0.07, wallHeight, shopDepth]} />
            <WorldMaterial tone="clay" />
          </mesh>

          {/* Back wall */}
          <mesh position={[0, wallHeight / 2, -shopDepth * 0.46]} castShadow>
            <boxGeometry args={[shopWidth, wallHeight, size * 0.07]} />
            <WorldMaterial tone="clay" />
          </mesh>

          {/* Roof */}
          <mesh position={[0, wallHeight + size * 0.07, 0]} castShadow>
            <boxGeometry args={[shopWidth * 1.12, size * 0.14, shopDepth * 1.12]} />
            <WorldMaterial tone="accent" />
          </mesh>

          {/* Front counter */}
          <mesh position={[0, size * 0.24, shopDepth * 0.43]} castShadow>
            <boxGeometry args={[shopWidth * 0.72, size * 0.42, size * 0.12]} />
            <WorldMaterial tone="timber" />
          </mesh>

          {/* Shop signboard */}
          <mesh position={[0, wallHeight * 0.88, shopDepth * 0.49]}>
            <boxGeometry args={[shopWidth * 0.78, size * 0.17, size * 0.055]} />
            <WorldMaterial tone="sign" />
          </mesh>

          <CanvasLabel
            position={[0, wallHeight * 0.88, shopDepth * 0.49 + size * 0.03]}
            fontSize={size * 0.105}
            text="SHOP"
          />

          {/* Product crates */}
          {[-1, 1].map((side) => (
            <mesh
              key={`crate-${side}`}
              position={[side * shopWidth * 0.42, size * 0.12, shopDepth * 0.72]}
              castShadow
            >
              <boxGeometry args={[size * 0.2, size * 0.24, size * 0.2]} />
              <WorldMaterial tone="timber" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
export function WorldMotorcycles({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const colors = ["#c94b36", "#276b9a", "#43845c"];

  return (
    <>
      {positions.map(([x, z], index) => {
        const color = colors[index % colors.length] ?? "#c94b36";

        return (
          <group key={`motorcycle-${index}`} position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]}>
            {/* Front wheel */}
            <mesh position={[0, size * 0.12, size * 0.3]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[size * 0.12, size * 0.035, 8, 16]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Rear wheel */}
            <mesh position={[0, size * 0.12, -size * 0.3]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[size * 0.12, size * 0.035, 8, 16]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Main motorcycle body */}
            <mesh position={[0, size * 0.3, 0]} castShadow>
              <boxGeometry args={[size * 0.15, size * 0.18, size * 0.48]} />
              <WorldMaterial tone="accent" color={color} />
            </mesh>

            {/* Fuel tank */}
            <mesh position={[0, size * 0.43, size * 0.04]} castShadow>
              <boxGeometry args={[size * 0.19, size * 0.15, size * 0.23]} />
              <WorldMaterial tone="metal" color={color} />
            </mesh>

            {/* Seat */}
            <mesh position={[0, size * 0.51, -size * 0.16]}>
              <boxGeometry args={[size * 0.17, size * 0.055, size * 0.25]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Handlebar */}
            <mesh position={[0, size * 0.57, size * 0.29]}>
              <boxGeometry args={[size * 0.38, size * 0.035, size * 0.045]} />
              <WorldMaterial tone="metal" />
            </mesh>

            {/* Headlight */}
            <mesh position={[0, size * 0.43, size * 0.3]}>
              <sphereGeometry args={[size * 0.065, 10, 10]} />
              <WorldMaterial tone="linen" />
            </mesh>

            {/* Exhaust */}
            <mesh position={[size * 0.12, size * 0.19, -size * 0.2]}>
              <cylinderGeometry args={[size * 0.025, size * 0.025, size * 0.3, 8]} />
              <WorldMaterial tone="metal" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
export function WorldTricycles({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const colors = ["#e3b542", "#43845c", "#d97732"];

  const wheelRadius = size * 0.13;

  return (
    <>
      {positions.map(([x, z], index) => {
        const bodyColor = colors[index % colors.length] ?? "#e3b542";

        return (
          <group key={`tricycle-${index}`} position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]}>
            {/* Front wheel */}
            <mesh
              position={[0, wheelRadius, size * 0.38]}
              rotation={[0, Math.PI / 2, 0]}
              castShadow
            >
              <torusGeometry args={[wheelRadius, size * 0.035, 8, 16]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Rear left wheel */}
            <mesh
              position={[-size * 0.25, wheelRadius, -size * 0.28]}
              rotation={[0, Math.PI / 2, 0]}
              castShadow
            >
              <torusGeometry args={[wheelRadius, size * 0.035, 8, 16]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Rear right wheel */}
            <mesh
              position={[size * 0.25, wheelRadius, -size * 0.28]}
              rotation={[0, Math.PI / 2, 0]}
              castShadow
            >
              <torusGeometry args={[wheelRadius, size * 0.035, 8, 16]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Lower body */}
            <mesh position={[0, size * 0.28, -size * 0.02]} castShadow>
              <boxGeometry args={[size * 0.65, size * 0.28, size * 0.62]} />
              <WorldMaterial tone="accent" color={bodyColor} />
            </mesh>

            {/* Passenger cabin */}
            <mesh position={[0, size * 0.57, -size * 0.08]} castShadow>
              <boxGeometry args={[size * 0.58, size * 0.38, size * 0.4]} />
              <WorldMaterial tone="accent" color={bodyColor} />
            </mesh>

            {/* Front windshield */}
            <mesh position={[0, size * 0.59, size * 0.14]}>
              <boxGeometry args={[size * 0.46, size * 0.27, size * 0.025]} />
              <WorldMaterial tone="linen" color="#b9d9e8" />
            </mesh>

            {/* Roof canopy */}
            <mesh position={[0, size * 0.79, -size * 0.07]} castShadow>
              <boxGeometry args={[size * 0.72, size * 0.08, size * 0.56]} />
              <WorldMaterial tone="timber" color={bodyColor} />
            </mesh>

            {/* Driver seat */}
            <mesh position={[0, size * 0.43, size * 0.19]}>
              <boxGeometry args={[size * 0.28, size * 0.08, size * 0.2]} />
              <WorldMaterial tone="slate" />
            </mesh>

            {/* Headlight */}
            <mesh position={[0, size * 0.38, size * 0.3]}>
              <sphereGeometry args={[size * 0.055, 8, 8]} />
              <WorldMaterial tone="linen" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
export function WorldStreetVendors({
  positions,
  size,
}: {
  positions: readonly [number, number][];
  size: number;
}) {
  const canopyColors = ["#c94b36", "#e3b542", "#43845c"];

  return (
    <>
      {positions.map(([x, z], index) => {
        const canopyColor = canopyColors[index % canopyColors.length] ?? "#c94b36";

        return (
          <group key={`street-vendor-${index}`} position={[x, 0, z]}>
            {/* Stall table */}
            <mesh position={[0, size * 0.3, 0]} castShadow>
              <boxGeometry args={[size * 0.75, size * 0.12, size * 0.48]} />
              <WorldMaterial tone="timber" />
            </mesh>

            {/* Table support legs */}
            {[-1, 1].flatMap((sideX) =>
              [-1, 1].map((sideZ) => (
                <mesh
                  key={`leg-${sideX}-${sideZ}`}
                  position={[sideX * size * 0.3, size * 0.14, sideZ * size * 0.17]}
                >
                  <boxGeometry args={[size * 0.045, size * 0.28, size * 0.045]} />
                  <WorldMaterial tone="timber" />
                </mesh>
              )),
            )}

            {/* Umbrella canopy */}
            <mesh position={[0, size * 1.05, 0]} castShadow>
              <cylinderGeometry args={[size * 0.58, size * 0.58, size * 0.09, 8]} />
              <WorldMaterial tone="accent" color={canopyColor} />
            </mesh>

            {/* Umbrella centre pole */}
            <mesh position={[0, size * 0.68, 0]}>
              <cylinderGeometry args={[size * 0.025, size * 0.025, size * 0.75, 8]} />
              <WorldMaterial tone="metal" />
            </mesh>

            {/* Produce display */}
            {[-1, 0, 1].map((side, itemIndex) => (
              <mesh
                key={`produce-${itemIndex}`}
                position={[side * size * 0.2, size * 0.43, 0]}
                castShadow
              >
                <sphereGeometry args={[size * 0.095, 8, 8]} />
                <WorldMaterial tone={itemIndex === 1 ? "clay" : "foliage"} />
              </mesh>
            ))}

            {/* Storage crate */}
            <mesh position={[size * 0.48, size * 0.13, -size * 0.12]}>
              <boxGeometry args={[size * 0.22, size * 0.26, size * 0.22]} />
              <WorldMaterial tone="timber" />
            </mesh>
          </group>
        );
      })}
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
  height = WORLD_SCALE.door * 1.4,
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
  height?: number;
}) {
  const isMarket = variant === "market" || variant === "food";
  const isBank = variant === "bank";
  const isCivic = variant === "civic" || variant === "public-service";
  const isHealth = variant === "health" || variant === "clinic";
  const isSchool = variant === "school";
  const isChurch = variant === "church";
  const isMosque = variant === "mosque";
  const isWorship = variant === "worship" || isChurch || isMosque;
  const isTransit = variant === "transit" || variant === "transport";
  const isSport = variant === "sport";
  const isClub = variant === "club";
  const isServices = variant === "services";

  const roofTone = isMarket
    ? "accent"
    : isMosque
      ? "slate"
      : isWorship
        ? "clay"
        : isBank || isCivic
          ? "slate"
          : "roof";

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
      {isChurch && (
        <>
          {/* Pitched roof and compact bell tower distinguish the chapel silhouette. */}
          <mesh position={[-width * 0.2, height + 0.48, 0]} rotation={[0, 0, -0.42]} castShadow>
            <boxGeometry args={[width * 0.58, 0.16, depth + 0.24]} />
            <WorldMaterial tone="clay" />
          </mesh>
          <mesh position={[width * 0.2, height + 0.48, 0]} rotation={[0, 0, 0.42]} castShadow>
            <boxGeometry args={[width * 0.58, 0.16, depth + 0.24]} />
            <WorldMaterial tone="clay" />
          </mesh>
          <mesh position={[-width * 0.34, height + 0.42, 0]} castShadow>
            <boxGeometry args={[width * 0.2, height * 0.42, depth * 0.22]} />
            <WorldMaterial tone="linen" />
          </mesh>
          {/* Simple cross above the bell tower. */}
          <mesh position={[-width * 0.34, height + 0.82, depth * 0.02]}>
            <boxGeometry args={[0.07, 0.34, 0.07]} />
            <WorldMaterial tone="roof" />
          </mesh>
          <mesh position={[-width * 0.34, height + 0.83, depth * 0.02]}>
            <boxGeometry args={[0.24, 0.07, 0.07]} />
            <WorldMaterial tone="roof" />
          </mesh>
        </>
      )}

      {isMosque && (
        <>
          {/* A low dome and slender minaret create a distinct mosque profile. */}
          <mesh
            position={[0, height + 0.48, 0]}
            scale={[width * 0.24, height * 0.15, width * 0.24]}
            castShadow
          >
            <sphereGeometry args={[1, 12, 10]} />
            <WorldMaterial tone="roofLight" />
          </mesh>
          <mesh position={[width * 0.36, height * 0.58, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, height * 1.08, 8]} />
            <WorldMaterial tone="linen" />
          </mesh>
          <mesh position={[width * 0.36, height * 1.16, 0]} castShadow>
            <coneGeometry args={[0.13, 0.3, 8]} />
            <WorldMaterial tone="roof" />
          </mesh>
          <mesh position={[width * 0.36, height * 1.34, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <WorldMaterial tone="sign" />
          </mesh>
        </>
      )}

      {variant === "worship" && (
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
