import { useEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { Appearance } from "@/game/avatar-appearance";
import type { WalkPoint } from "@/game/grid-walk-path";
import { shopperLook } from "@/game/mall-appearance";
import { createWalker, stepWalker, type MallWalker } from "@/game/mall-movement";
import {
  STREET_DOOR,
  STREET_DOOR_FRONT,
  STREET_OBSTACLES,
  STREET_PEDESTRIANS,
  STREET_RIDER_SPOT,
  findStreetPath,
  type StreetRect,
} from "@/game/osun-mall-street-layout";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting, WorldMaterial } from "./WorldScene";

/** Mutable state for the visitor on the street. Lives in a ref, so frames never re-render React. */
export type StreetSim = {
  player: { pos: WalkPoint; walker: MallWalker | null; moving: boolean };
};

export function createStreetSim(): StreetSim {
  return {
    player: { pos: [STREET_DOOR_FRONT[0], STREET_DOOR_FRONT[1]], walker: null, moving: false },
  };
}

/** A click counts only when the pointer barely moved, so dragging the camera never triggers it. */
function isClick(event: ThreeEvent<MouseEvent>) {
  return event.delta <= 5;
}

/** The okada rider's look: an orange vest over dark trousers. */
const RIDER_APPEARANCE: Appearance = {
  clothed: true,
  skin: 2,
  hair: 0,
  hairColor: 0,
  outfit: 2,
  bottoms: 1,
  shoes: 0,
};

function Block({
  rect,
  height,
  tone = "concrete",
  color,
}: {
  rect: StreetRect;
  height: number;
  tone?: "concrete" | "wall" | "glass" | "door" | "timber";
  color?: string;
}) {
  const width = rect.maxX - rect.minX;
  const depth = rect.maxZ - rect.minZ;
  return (
    <mesh
      position={[(rect.minX + rect.maxX) / 2, height / 2, (rect.minZ + rect.maxZ) / 2]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, depth]} />
      <WorldMaterial tone={tone} {...(color === undefined ? {} : { color })} />
    </mesh>
  );
}

/** The bike's place relative to the rider's stand, so the bike moves with the rider. */
const BIKE_OFFSET: WalkPoint = [2.6, -0.5];

/**
 * The okada: the rider and the bike together. The rider walks to `target` when a ride is found,
 * and walks back to the stand when `target` clears. Clicking either opens the ride panel.
 */
function OkadaRider({ onRider, target }: { onRider: () => void; target: WalkPoint | null }) {
  const group = useRef<Group>(null);
  const rider = useRef<{ pos: WalkPoint; walker: MallWalker | null }>({
    pos: [STREET_RIDER_SPOT[0], STREET_RIDER_SPOT[1]],
    walker: null,
  });
  const goal = useRef<string | null>(null);
  useEffect(() => {
    const key = target ? `${target[0]},${target[1]}` : "stand";
    if (goal.current === key) return;
    goal.current = key;
    const to = target ?? STREET_RIDER_SPOT;
    const path = findStreetPath(rider.current.pos, to);
    if (path) rider.current.walker = createWalker(rider.current.pos, path);
  }, [target]);
  useFrame((_, delta) => {
    const state = rider.current;
    if (state.walker) {
      const next = stepWalker(state.walker, Math.min(delta, 0.1));
      state.pos = next.pos;
      state.walker = next.done ? null : next;
    }
    group.current?.position.set(state.pos[0], 0, state.pos[1]);
  });
  return (
    <group
      ref={group}
      onClick={(event) => {
        if (!isClick(event)) return;
        event.stopPropagation();
        onRider();
      }}
    >
      <group position={[BIKE_OFFSET[0], 0, BIKE_OFFSET[1]]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1, 0.3, 0.25]} />
          <meshStandardMaterial color="#f5c400" roughness={0.6} />
        </mesh>
        {[-0.36, 0.36].map((offset) => (
          <mesh key={offset} position={[offset, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.1, 12]} />
            <meshStandardMaterial color="#1f2328" roughness={0.9} />
          </mesh>
        ))}
      </group>
      <WorldCharacter
        name="Okada rider"
        gender="male"
        appearance={RIDER_APPEARANCE}
        facing="west"
        animation="idle"
        position={[0, 0, 0]}
      />
    </group>
  );
}

/** The visitor. Walks the route the venue checked, and stands still otherwise. */
function StreetPlayer({
  sim,
  appearance,
  gender,
}: {
  sim: { current: StreetSim };
  appearance: Appearance;
  gender: string;
}) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const player = sim.current.player;
    if (player.walker) {
      const next = stepWalker(player.walker, Math.min(delta, 0.1));
      player.pos = next.pos;
      player.moving = next.moving;
      player.walker = next.done ? null : next;
      if (next.done) player.moving = false;
    }
    group.current?.position.set(player.pos[0], 0, player.pos[1]);
  });
  return (
    <group ref={group}>
      <WorldCharacter
        name="You"
        gender={gender}
        appearance={appearance}
        facing="south"
        animation="idle"
        position={[0, 0, 0]}
      />
    </group>
  );
}

/** The street: road and pavement, the mall's front with its door, the okada and some pedestrians. */
export function OsunMallStreet3D({
  sim,
  playerAppearance,
  playerGender,
  onWalk,
  onEnterMall,
  onRider,
  riderTarget,
}: {
  sim: { current: StreetSim };
  playerAppearance: Appearance;
  playerGender: string;
  onWalk: (point: WalkPoint) => void;
  onEnterMall: () => void;
  /** Where the rider should come to, when a ride has been found; null to wait at the stand. */
  riderTarget: WalkPoint | null;
  onRider: () => void;
}) {
  return (
    <>
      <WorldLighting size={16} />
      {/* Road and pavement. Clicking the ground walks the visitor there. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0.9]}
        receiveShadow
        onClick={(event) => {
          if (!isClick(event)) return;
          event.stopPropagation();
          onWalk([event.point.x, event.point.z]);
        }}
      >
        <planeGeometry args={[20, 12]} />
        <WorldMaterial tone="concrete" color="#c9bda6" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.2]} receiveShadow>
        <planeGeometry args={[20, 2.8]} />
        <WorldMaterial tone="concrete" color="#4b4f57" />
      </mesh>

      {/* The mall's front building. Its door takes the visitor back inside. */}
      <mesh position={[0, 2, -5.8]} castShadow receiveShadow>
        <boxGeometry args={[20, 4, 2.4]} />
        <WorldMaterial tone="wall" color="#d9c9a8" />
      </mesh>
      <mesh
        position={[STREET_DOOR[0], 1.1, STREET_DOOR[1] - 0.05]}
        onClick={(event) => {
          if (!isClick(event)) return;
          event.stopPropagation();
          onEnterMall();
        }}
      >
        <boxGeometry args={[1.8, 2.2, 0.12]} />
        <WorldMaterial tone="glass" color="#8fb7c8" />
      </mesh>

      {STREET_OBSTACLES.map((rect) => (
        <Block key={rect.id} rect={rect} height={rect.id === "shelter" ? 2.4 : 1.2} tone="timber" />
      ))}
      <OkadaRider onRider={onRider} target={riderTarget} />

      {STREET_PEDESTRIANS.map((spot, index) => {
        const look = shopperLook(index + 40);
        return (
          <group key={`pedestrian-${index}`} position={[spot[0], 0, spot[1]]}>
            <WorldCharacter
              name={`Passer-by ${index + 1}`}
              gender={look.gender}
              appearance={look.appearance}
              facing={index % 2 === 0 ? "south" : "west"}
              animation="idle"
              position={[0, 0, 0]}
            />
          </group>
        );
      })}

      <StreetPlayer sim={sim} appearance={playerAppearance} gender={playerGender} />
    </>
  );
}

/** Starts a visitor's walk along the street. The venue has already checked the route. */
export function startStreetWalk(sim: { current: StreetSim }, path: WalkPoint[]) {
  sim.current.player.walker = createWalker(sim.current.player.pos, path);
}
