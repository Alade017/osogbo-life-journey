import { MallStreetArchitecture } from "./MallStreetArchitecture";
import { useEffect, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { Appearance } from "@/game/avatar-appearance";
import type { WalkPoint } from "@/game/grid-walk-path";
import { shopperLook } from "@/game/mall-appearance";
import { createWalker, stepWalker, type MallWalker } from "@/game/mall-movement";
import {
  STREET_DOOR_FRONT,
  STREET_PEDESTRIANS,
  STREET_RIDER_SPOT,
  findStreetPath,
  findOkadaPickup,
} from "@/game/osun-mall-street-layout";
import { trafficFrameSeconds, trafficSpeed, trafficBrakingSpeed, trafficHeading } from "@/game/town-traffic-motion";
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
const OKADA_SEAT = { height: 0.65, thickness: 0.12, centerZ: -0.22, length: 0.65 } as const;
const RIDER_APPEARANCE: Appearance = {
  clothed: true,
  skin: 2,
  hair: 0,
  hairColor: 0,
  outfit: 2,
  bottoms: 1,
  shoes: 0,
};

/** The bike and its seated rider share one moving root. Local motion never confirms a ride. */
function OkadaRider({ onRider, target }: { onRider: () => void; target: WalkPoint | null }) {
  const group = useRef<Group>(null);
  const rider = useRef<{ pos: WalkPoint; walker: MallWalker | null; speed: number; yaw: number }>({
    pos: STREET_RIDER_SPOT, walker: null, speed: 0, yaw: 0,
  });
  useEffect(() => {
    const state = rider.current;
    const path = target ? findOkadaPickup(state.pos, target) : findStreetPath(state.pos, STREET_RIDER_SPOT);
    state.walker = path ? createWalker(state.pos, path) : null;
    if (!path) state.speed = 0;
  }, [target]);
  useFrame((_, delta) => {
    const state = rider.current;
    const dt = trafficFrameSeconds(delta);
    if (state.walker && dt > 0) {
      const remaining = state.walker.points.slice(state.walker.next).reduce((acc, point) => ({
        pos: point, distance: acc.distance + Math.hypot(point[0]-acc.pos[0],point[1]-acc.pos[1]),
      }), {pos: state.pos, distance: 0}).distance;
      state.speed = trafficSpeed(state.speed, Math.min(state.walker.speed, trafficBrakingSpeed(remaining)), dt);
      const next = stepWalker({...state.walker, speed: state.speed}, dt);
      const dx = next.pos[0]-state.pos[0], dz = next.pos[1]-state.pos[1];
      if (Math.hypot(dx,dz)>0.00001) state.yaw = trafficHeading(state.yaw, Math.atan2(dx,dz), dt);
      state.pos = next.pos;
      state.walker = next.done ? null : {...next, speed: state.walker.speed};
      if (next.done) state.speed = 0;
    }
    if (group.current) {
      group.current.position.set(state.pos[0],0,state.pos[1]);
      group.current.rotation.y = state.yaw;
    }
  });
  return (
    <group ref={group} position={[STREET_RIDER_SPOT[0],0,STREET_RIDER_SPOT[1]]}
      onClick={event => { if (!isClick(event)) return; event.stopPropagation(); onRider(); }}>
      {/* Longitudinal axis matches the character's forward direction. */}
      <mesh position={[0,0.47,0.08]} castShadow>
        <boxGeometry args={[0.28,0.28,0.85]} />
        <meshStandardMaterial color="#f5c400" roughness={0.6} />
      </mesh>
      <mesh position={[0,OKADA_SEAT.height,OKADA_SEAT.centerZ]} castShadow>
        <boxGeometry args={[0.3,OKADA_SEAT.thickness,OKADA_SEAT.length]} />
        <WorldMaterial tone="road" />
      </mesh>
      <mesh position={[0,0.88,0.43]}>
        <boxGeometry args={[0.62,0.06,0.08]} />
        <WorldMaterial tone="metal" />
      </mesh>
      {[-0.48,0.48].map(z => (
        <mesh key={z} position={[0,0.24,z]} rotation={[0,0,Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.24,0.24,0.12,12]} />
          <WorldMaterial tone="road" />
        </mesh>
      ))}
      <WorldCharacter name="Okada rider" gender="male" appearance={RIDER_APPEARANCE}
        facing="south" taskPose="motorcycleDriver" seatHeight={OKADA_SEAT.height + OKADA_SEAT.thickness / 2} position={[0,0,OKADA_SEAT.centerZ + OKADA_SEAT.length / 4]} />
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
  const [pose, setPose] = useState({ moving: false, facing: "south" });
  const poseRef = useRef(pose);
  const updatePose = (moving: boolean, dx: number, dz: number) => {
    const facing =
      Math.abs(dx) + Math.abs(dz) < 0.0001
        ? poseRef.current.facing
        : Math.abs(dx) > Math.abs(dz)
          ? dx > 0
            ? "east"
            : "west"
          : dz > 0
            ? "south"
            : "north";
    if (moving !== poseRef.current.moving || facing !== poseRef.current.facing) {
      poseRef.current = { moving, facing };
      setPose(poseRef.current);
    }
  };
  useFrame((_, delta) => {
    const player = sim.current.player;
    const previous = player.pos;
    if (player.walker) {
      const next = stepWalker(player.walker, Math.min(delta, 0.1));
      player.pos = next.pos;
      player.moving = next.moving;
      player.walker = next.done ? null : next;
      if (next.done) player.moving = false;
    }
    updatePose(player.moving, player.pos[0] - previous[0], player.pos[1] - previous[1]);
    group.current?.position.set(player.pos[0], 0, player.pos[1]);
  });
  return (
    <group ref={group}>
      <WorldCharacter
        name="You"
        gender={gender}
        appearance={appearance}
        facing={pose.facing}
        animation={pose.moving ? "walk" : "idle"}
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
      <WorldLighting size={24} refined contactShadows={false} />
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, -1.2]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[20, 2.8]} />
        <WorldMaterial tone="concrete" color="#4b4f57" />
      </mesh>

      <MallStreetArchitecture onEnterMall={onEnterMall} />
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
