import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COLOURS, type Colour } from "@/lib/mini-games/ludo-engine";
import { BOARD_SIZE } from "@/lib/mini-games/ludo-board";
import { LUDO_COLOURS } from "@/components/game/mini-games/ludo-palette";

/** A pawn as the board draws it: centre in board units, scale as a fraction of a square. */
export type ScenePiece = {
  key: string;
  colour: Colour;
  x: number;
  y: number;
  scale: number;
  playable: boolean;
};

const CENTRE = BOARD_SIZE / 2;
/** How many board squares the camera shows across the stage. */
const VIEW_SQUARES = BOARD_SIZE;
/** Tilt of the camera away from straight down, so the pawns show their height. */
const TILT = (24 * Math.PI) / 180;
const CAMERA_DISTANCE = 24;
/** Seconds a pawn takes to walk one square. Matches the board's time per tile. */
const HOP_SECONDS = 0.17;
/** How high a pawn lifts while it crosses a square. */
const HOP_LIFT = 0.34;

/** Half profile of a pawn (radius, height), turned into a solid by LatheGeometry. */
const PROFILE = [
  [0, 0],
  [0.42, 0],
  [0.42, 0.1],
  [0.34, 0.14],
  [0.2, 0.2],
  [0.1, 0.42],
  [0.16, 0.56],
  [0.1, 0.62],
  [0, 0.64],
].map(([x, y]) => new THREE.Vector2(x ?? 0, y ?? 0));
const BODY = new THREE.LatheGeometry(PROFILE, 48);
const HEAD = new THREE.SphereGeometry(0.22, 32, 24).translate(0, 0.86, 0);

type Materials = { plain: Record<Colour, THREE.Material>; glow: Record<Colour, THREE.Material> };

function useMaterials(): Materials {
  return useMemo(() => {
    const make = (colour: Colour, glow: boolean) =>
      new THREE.MeshStandardMaterial({
        color: LUDO_COLOURS[colour],
        roughness: 0.3,
        metalness: 0.05,
        emissive: glow ? new THREE.Color("#f5c518") : new THREE.Color("#000000"),
        emissiveIntensity: glow ? 0.4 : 0,
      });
    const build = (glow: boolean) => {
      const out = {} as Record<Colour, THREE.Material>;
      for (const colour of COLOURS) out[colour] = make(colour, glow);
      return out;
    };
    return { plain: build(false), glow: build(true) };
  }, []);
}

/** Keeps the square board's full width in view, whatever the stage size. */
function FitCamera() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.zoom = width / VIEW_SQUARES;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, width, invalidate]);
  return null;
}

function PawnMesh({ piece, materials }: { piece: ScenePiece; materials: Materials }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const goal = useRef({ x: 0, z: 0, scale: 0 });
  const hop = useRef({ fromX: 0, fromZ: 0, t: 1 });
  const mounted = useRef(false);
  goal.current = {
    x: piece.x - CENTRE,
    // Squares foreshorten by cos(TILT) on screen; stretch the bases to keep them on their squares.
    z: (piece.y - CENTRE) / Math.cos(TILT),
    scale: piece.scale * 0.95,
  };

  // Each move to a new square starts a hop from where the pawn is now, so it is walked tile by tile.
  useEffect(() => {
    const pawn = group.current;
    if (!pawn) return;
    if (!mounted.current) {
      mounted.current = true;
      pawn.position.set(goal.current.x, 0, goal.current.z);
      pawn.scale.setScalar(goal.current.scale);
      return;
    }
    hop.current = { fromX: pawn.position.x, fromZ: pawn.position.z, t: 0 };
    invalidate();
  }, [piece.x, piece.y, invalidate]);

  useEffect(() => {
    invalidate();
  }, [piece.scale, invalidate]);

  useFrame((state, delta) => {
    const pawn = group.current;
    if (!pawn) return;
    const { x, z, scale } = goal.current;
    const current = hop.current;
    if (current.t < 1) {
      current.t = Math.min(1, current.t + delta / HOP_SECONDS);
      const eased = current.t * current.t * (3 - 2 * current.t);
      pawn.position.x = current.fromX + (x - current.fromX) * eased;
      pawn.position.z = current.fromZ + (z - current.fromZ) * eased;
      // The pawn arcs over each square and lands flat on it.
      pawn.position.y = Math.sin(Math.PI * current.t) * HOP_LIFT;
    } else {
      pawn.position.set(x, 0, z);
    }
    const ease = 1 - Math.exp(-delta * 14);
    const before = pawn.scale.x;
    pawn.scale.setScalar(before + (scale - before) * ease);
    if (current.t < 1 || Math.abs(scale - pawn.scale.x) > 0.001) {
      state.invalidate();
    }
  });

  const material = piece.playable ? materials.glow[piece.colour] : materials.plain[piece.colour];
  return (
    <group ref={group}>
      <mesh geometry={BODY} material={material} castShadow />
      <mesh geometry={HEAD} material={material} castShadow />
    </group>
  );
}

/**
 * Real 3D pawns drawn over the DOM board. The DOM pieces stay as the click targets.
 * The camera looks down a little, so the pawns' shadows fall onto the squares.
 */
export function LudoPawns3D({ pieces }: { pieces: readonly ScenePiece[] }) {
  const materials = useMaterials();
  return (
    <div className="lb-scene" aria-hidden="true">
      <Canvas
        orthographic
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{
          position: [0, CAMERA_DISTANCE * Math.cos(TILT), CAMERA_DISTANCE * Math.sin(TILT)],
          near: 0.1,
          far: 100,
        }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <FitCamera />
        <ambientLight intensity={0.8} />
        <hemisphereLight args={["#ffffff", "#c9b99a", 0.5]} />
        <directionalLight
          position={[-3, 22, 6]}
          intensity={1.7}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-camera-near={1}
          shadow-camera-far={60}
          shadow-bias={-0.0005}
        />
        {pieces.map((piece) => (
          <PawnMesh key={piece.key} piece={piece} materials={materials} />
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[16, 16]} />
          <shadowMaterial transparent opacity={0.22} />
        </mesh>
      </Canvas>
    </div>
  );
}

/** One pawn on its own, for the player cards and the results popup. */
export function PawnMark3D({ colour, size }: { colour: Colour; size: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: LUDO_COLOURS[colour],
        roughness: 0.3,
        metalness: 0.05,
      }),
    [colour],
  );
  return (
    <span className="lb-mark-3d" style={{ width: size, height: size }} aria-hidden="true">
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{
          position: [0, CAMERA_DISTANCE * Math.cos(TILT), CAMERA_DISTANCE * Math.sin(TILT)],
          zoom: size / 1.25,
          near: 0.1,
          far: 100,
        }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <ambientLight intensity={0.8} />
        <hemisphereLight args={["#ffffff", "#c9b99a", 0.5]} />
        <directionalLight position={[-3, 22, 6]} intensity={1.7} />
        {/* The pawn stands 1.08 units tall; centre it on the canvas. */}
        <group position={[0, -0.54, 0]}>
          <mesh geometry={BODY} material={material} />
          <mesh geometry={HEAD} material={material} />
        </group>
      </Canvas>
    </span>
  );
}
