import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import type { Appearance } from "@/game/avatar-appearance";
import type { WalkPoint } from "@/game/grid-walk-path";
import { advanceCrowd, MALL_CROWD_TARGET, type MallShopper } from "@/game/mall-crowd";
import { createWalker, stepWalker, type MallWalker } from "@/game/mall-movement";
import {
  MALL_BOUNDS,
  MALL_ENTRANCE,
  MALL_OBSTACLES,
  MALL_RESTRICTED_ZONES,
  MALL_STAFF,
  type MallRect,
} from "@/game/osun-mall-layout";
import { staffLook, type MallGender } from "@/game/mall-appearance";
import { MALL_PROPS, type MallPropId, type MallTarget } from "@/game/mall-reactions";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting, WorldMaterial } from "./WorldScene";

/** A cosmetic item the player has placed on the floor. */
export type PlacedProp = { id: MallPropId; position: WalkPoint };

/** A click counts only when the pointer barely moved, so dragging the camera never triggers it. */
function isClick(event: ThreeEvent<MouseEvent>) {
  return event.delta <= 5;
}

/** A person another player's device reports in the mall. Positions come from the server. */
export type MallPerson = {
  sessionId: string;
  name: string;
  gender: string;
  appearance: Appearance;
  position: WalkPoint;
};

/** Mutable simulation state shared by the scene parts. Lives in a ref, so frames never re-render React. */
export type MallSim = {
  player: { pos: WalkPoint; walker: MallWalker | null; moving: boolean; lastSent: number };
  shoppers: MallShopper[];
  nextSeed: number;
  people: MallPerson[];
};

/** Seconds between position reports while walking, so the server can check each step. */
const SEND_INTERVAL_MS = 200;
/** How often React re-renders for animation changes; positions move every frame without it. */
const SNAPSHOT_INTERVAL_MS = 250;

export function createMallSim(people: MallPerson[] = []): MallSim {
  return {
    player: { pos: [MALL_ENTRANCE[0], MALL_ENTRANCE[1]], walker: null, moving: false, lastSent: 0 },
    shoppers: [],
    nextSeed: 0,
    people,
  };
}

function Block({
  at,
  size,
  tone = "wall",
  color,
  onClick,
}: {
  at: [number, number, number];
  size: [number, number, number];
  tone?:
    "wall" | "tileLight" | "metal" | "timber" | "linen" | "concrete" | "slate" | "door" | "glass";
  color?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <mesh
      position={at}
      castShadow
      receiveShadow
      onClick={(event) => {
        if (!onClick || !isClick(event)) return;
        event.stopPropagation();
        onClick();
      }}
    >
      <boxGeometry args={size} />
      <WorldMaterial tone={tone} {...(color === undefined ? {} : { color })} />
    </mesh>
  );
}

/** Which kind of thing a click on each fixture means. Queue posts are not interactive. */
function targetForFixture(id: string): MallTarget | null {
  if (id === "mall-checkout") return { kind: "till", id };
  if (id === "mall-seats") return { kind: "seat", id };
  if (id === "mall-display" || id === "mall-gallery-shop") return { kind: "display", id };
  if (id === "mall-shelves" || id === "mall-essentials") return { kind: "shelf", id };
  return null;
}

function fixtureHeight(rect: MallRect) {
  if (rect.id.startsWith("queue-post")) return 1.1;
  if (rect.id === "mall-shelves" || rect.id === "mall-essentials") return 2;
  if (rect.id === "mall-display" || rect.id === "mall-gallery-shop") return 1.6;
  if (rect.id === "mall-seats") return 0.9;
  return 1; // checkout counter
}

/** Floor, walls and the restricted rooms. The floor is the click target for walking. */
function MallInterior({
  onWalk,
  onInteract,
  accent,
}: {
  onWalk: (point: WalkPoint) => void;
  onInteract: (target: MallTarget) => void;
  accent: string;
}) {
  const width = MALL_BOUNDS.maxX - MALL_BOUNDS.minX + 0.8;
  const depth = 14;
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isClick(event)) return;
    event.stopPropagation();
    onWalk([event.point.x, event.point.z]);
  };
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={handleClick}
      >
        <planeGeometry args={[width, depth]} />
        <WorldMaterial tone="tileLight" color="#efe5d2" />
      </mesh>
      {/* Back wall and side walls; the front is open to the street. */}
      <Block at={[0, 1.8, -7]} size={[16, 3.6, 0.18]} color="#d9c9a8" />
      <Block at={[-8, 1.8, 0]} size={[0.18, 3.6, 14]} color="#d9c9a8" />
      <Block at={[8, 1.8, 0]} size={[0.18, 3.6, 14]} color="#d9c9a8" />
      {MALL_RESTRICTED_ZONES.map((zone) => {
        const cx = (zone.minX + zone.maxX) / 2;
        const cz = (zone.minZ + zone.maxZ) / 2;
        const w = zone.maxX - zone.minX;
        const d = zone.maxZ - zone.minZ;
        return (
          <group key={zone.id}>
            {/* A low red strip marks the edge of the staff-only room. */}
            <Block at={[cx, 0.06, zone.maxZ]} size={[w, 0.12, 0.08]} color="#b3261e" />
            <Block at={[cx, 0.06, zone.minZ + 0.1]} size={[w, 0.12, 0.08]} color="#b3261e" />
            <mesh position={[cx, 1.2, cz]}>
              <boxGeometry args={[0.04, 2.4, d]} />
              <meshStandardMaterial color="#6b5b4a" transparent opacity={0.35} />
            </mesh>
          </group>
        );
      })}
      {MALL_OBSTACLES.map((rect) => {
        const h = fixtureHeight(rect);
        const target = targetForFixture(rect.id);
        return (
          <Block
            key={rect.id}
            at={[(rect.minX + rect.maxX) / 2, h / 2, (rect.minZ + rect.maxZ) / 2]}
            size={[rect.maxX - rect.minX, h, rect.maxZ - rect.minZ]}
            tone={rect.id === "mall-checkout" ? "slate" : "linen"}
            color={rect.id === "mall-checkout" ? accent : undefined}
            onClick={target ? () => onInteract(target) : undefined}
          />
        );
      })}
    </group>
  );
}

/** Fixed staff. Tills stand at the counter; the rest stand and face their way. */
function MallStaffLayer({ onInteract }: { onInteract: (target: MallTarget) => void }) {
  return (
    <group>
      {MALL_STAFF.map((member, index) => {
        const look = staffLook(member.role, index);
        return (
          <group
            key={member.id}
            position={[member.position[0], 0, member.position[1]]}
            onClick={(event) => {
              if (!isClick(event)) return;
              event.stopPropagation();
              onInteract({ kind: "staff", role: member.role, id: member.id });
            }}
          >
            <WorldCharacter
              gender={look.gender}
              appearance={look.appearance}
              name={member.id}
              facing={member.facing}
              animation={member.role === "till" ? "work" : "idle"}
              position={[0, 0, 0]}
            />
          </group>
        );
      })}
    </group>
  );
}

/** One shopper. Position comes from the simulation every frame; only animation is React state. */
function ShopperFigure({
  id,
  moving,
  gender,
  appearance,
  sim,
  onInteract,
}: {
  id: string;
  moving: boolean;
  gender: MallGender;
  appearance: Appearance;
  sim: { current: MallSim };
  onInteract: (target: MallTarget) => void;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const shopper = sim.current.shoppers.find((candidate) => candidate.id === id);
    const node = group.current;
    if (!node) return;
    node.visible = Boolean(shopper);
    if (shopper) node.position.set(shopper.walker.pos[0], 0, shopper.walker.pos[1]);
  });
  return (
    <group
      ref={group}
      onClick={(event) => {
        if (!isClick(event)) return;
        event.stopPropagation();
        onInteract({ kind: "shopper", id });
      }}
    >
      <WorldCharacter
        gender={gender}
        appearance={appearance}
        name={id}
        facing="south"
        animation={moving ? "walk" : "idle"}
        position={[0, 0, 0]}
      />
    </group>
  );
}

/** Items the player has placed, drawn as simple coloured blocks on the floor. */
function PlacedPropsLayer({ placed }: { placed: readonly PlacedProp[] }) {
  return (
    <group>
      {placed.map((prop) => {
        const definition = MALL_PROPS.find((candidate) => candidate.id === prop.id);
        return (
          <mesh key={prop.id} position={[prop.position[0], 0.3, prop.position[1]]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color={definition?.color ?? "#888888"} roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function CrowdLayer({
  sim,
  onInteract,
}: {
  sim: { current: MallSim };
  onInteract: (target: MallTarget) => void;
}) {
  const [snapshot, setSnapshot] = useState<
    Array<{ id: string; moving: boolean; gender: MallGender; appearance: Appearance }>
  >([]);
  useFrame((_, delta) => {
    const state = sim.current;
    const next = advanceCrowd(
      state.shoppers,
      Math.min(delta, 0.1),
      state.nextSeed,
      MALL_CROWD_TARGET,
    );
    state.shoppers = next.shoppers;
    state.nextSeed = next.nextSeed;
  });
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot(
        sim.current.shoppers.map((shopper) => ({
          id: shopper.id,
          moving: shopper.walker.moving,
          gender: shopper.gender,
          appearance: shopper.appearance,
        })),
      );
    }, SNAPSHOT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sim]);
  return (
    <group>
      {snapshot.map((shopper) => (
        <ShopperFigure
          key={shopper.id}
          id={shopper.id}
          moving={shopper.moving}
          gender={shopper.gender}
          appearance={shopper.appearance}
          sim={sim}
          onInteract={onInteract}
        />
      ))}
    </group>
  );
}

/** The player's own character. Walks the path the server accepted, and reports each step. */
function PlayerFigure({
  sim,
  moving,
  gender,
  appearance,
  onMove,
}: {
  sim: { current: MallSim };
  moving: boolean;
  gender: string;
  appearance: Appearance;
  onMove: (point: WalkPoint) => void;
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
    const now = performance.now();
    if (player.moving && now - player.lastSent >= SEND_INTERVAL_MS) {
      player.lastSent = now;
      onMove(player.pos);
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
        animation={moving ? "walk" : "idle"}
        position={[0, 0, 0]}
      />
    </group>
  );
}

/** Another player. Moves smoothly toward the last position the server reported. */
function RemoteFigure({ person }: { person: MallPerson }) {
  const group = useRef<Group>(null);
  const current = useRef(new Vector3(person.position[0], 0, person.position[1]));
  const target = useRef(new Vector3());
  const [moving, setMoving] = useState(false);
  useFrame((_, delta) => {
    target.current.set(person.position[0], 0, person.position[1]);
    const gap = current.current.distanceTo(target.current);
    current.current.lerp(target.current, Math.min(1, delta * 8));
    group.current?.position.copy(current.current);
    const isMoving = gap > 0.05;
    if (isMoving !== moving) setMoving(isMoving);
  });
  return (
    <group ref={group}>
      <WorldCharacter
        gender={person.gender}
        appearance={person.appearance}
        name={person.name}
        facing="south"
        animation={moving ? "walk" : "idle"}
        position={[0, 0, 0]}
      />
    </group>
  );
}

/** Keeps the camera behind the player, so they stay in view as they walk. */
function FollowCamera({ sim }: { sim: { current: MallSim } }) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  useEffect(() => {
    if ("fov" in camera) {
      camera.fov = 40;
      camera.updateProjectionMatrix();
    }
  }, [camera]);
  useFrame((_, delta) => {
    const [x, z] = sim.current.player.pos;
    target.current.set(x, 0, z);
    const desired = new Vector3(x, 14, z + 13);
    camera.position.lerp(desired, Math.min(1, delta * 4));
    camera.lookAt(target.current.x, 0.8, target.current.z);
  });
  return null;
}

/** The full mall scene: floor, fixtures, staff, the crowd, other players and the player. */
export function OsunMall3D({
  sim,
  people,
  playerMoving,
  playerGender,
  playerAppearance,
  placed,
  onWalk,
  onMove,
  onInteract,
  accent,
}: {
  sim: { current: MallSim };
  people: MallPerson[];
  playerMoving: boolean;
  playerGender: string;
  playerAppearance: Appearance;
  placed: readonly PlacedProp[];
  onWalk: (point: WalkPoint) => void;
  onMove: (point: WalkPoint) => void;
  onInteract: (target: MallTarget) => void;
  accent: string;
}) {
  return (
    <>
      <FollowCamera sim={sim} />
      <WorldLighting size={16} />
      <MallInterior onWalk={onWalk} onInteract={onInteract} accent={accent} />
      <MallStaffLayer onInteract={onInteract} />
      <PlacedPropsLayer placed={placed} />
      <CrowdLayer sim={sim} onInteract={onInteract} />
      {people.map((person) => (
        <RemoteFigure key={person.sessionId} person={person} />
      ))}
      <PlayerFigure
        sim={sim}
        moving={playerMoving}
        gender={playerGender}
        appearance={playerAppearance}
        onMove={onMove}
      />
    </>
  );
}
