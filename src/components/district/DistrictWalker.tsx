import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import type { AvatarEquipment, AvatarFacing } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import type { DistrictLayout } from "@/game/districts/district-layout";
import {
  WALKER_SPAWN,
  lerpAngle,
  moveFromInput,
  moveWalker,
  solidsFor,
  type WalkInput,
} from "@/game/districts/district-walk";

// A playable character on a district. It renders the game's own WorldCharacter (the same rigged
// body, clothes and walk cycle as the live neighbourhood), with WASD or arrow keys and a
// third-person camera that trails the player the way GTA's on-foot camera does.

const WALK_SPEED_MPS = 4.2;
const TURN_RATE_RAD_S = 2.4;
const CAMERA_DISTANCE_M = 9;
const CAMERA_HEIGHT_M = 4.5;
const CAMERA_LOOK_Y_M = 1.4;

type Key = keyof WalkInput | "turnLeft" | "turnRight";

function keyFor(code: string): Key | null {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "forward";
    case "KeyS":
    case "ArrowDown":
      return "back";
    case "KeyA":
      return "left";
    case "KeyD":
      return "right";
    case "ArrowLeft":
      return "turnLeft";
    case "ArrowRight":
      return "turnRight";
    default:
      return null;
  }
}

/** The compass facing for a movement direction, matching WorldCharacter's facing names. */
function facingFor(dx: number, dz: number): AvatarFacing {
  if (Math.abs(dz) >= Math.abs(dx)) return dz < 0 ? "north" : "south";
  return dx > 0 ? "east" : "west";
}

const DEFAULT_APPEARANCE: Appearance = {};
const NO_EQUIPMENT: readonly AvatarEquipment[] = [];

interface WalkView {
  x: number;
  z: number;
  facing: AvatarFacing;
  animation: "idle" | "walk";
}

export interface WalkerCharacter {
  appearance?: Appearance;
  gender?: string;
  equipment?: readonly AvatarEquipment[];
}

export function DistrictWalker({
  layout,
  character = {},
}: {
  layout: DistrictLayout;
  /** The saved character to show: appearance, gender and equipment as the live game holds them. */
  character?: WalkerCharacter;
}) {
  const camera = useThree((state) => state.camera);
  const solids = useMemo(() => solidsFor(layout), [layout]);
  const half = layout.sizeM / 2;
  const root = useRef<Group>(null);
  const pos = useRef<{ x: number; z: number }>({ x: WALKER_SPAWN.x, z: WALKER_SPAWN.z });
  const heading = useRef(0);
  const facing = useRef<AvatarFacing>("south");
  // Camera yaw: the camera sits at (sin yaw, cos yaw) from the player. 0 puts it on the +z side.
  const camYaw = useRef(0);
  const placed = useRef(false);
  const wanted = useMemo(() => new Vector3(), []);
  const [view, setView] = useState<WalkView>({
    x: WALKER_SPAWN.x,
    z: WALKER_SPAWN.z,
    facing: "south",
    animation: "idle",
  });
  const lastView = useRef(view);
  const keys = useRef<Record<Key, boolean>>({
    forward: false,
    back: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
  });

  useEffect(() => {
    const held = keys.current;
    const set = (event: KeyboardEvent, value: boolean) => {
      const key = keyFor(event.code);
      if (!key) return;
      held[key] = value;
      event.preventDefault();
    };
    const down = (event: KeyboardEvent) => set(event, true);
    const up = (event: KeyboardEvent) => set(event, false);
    const clear = () => {
      for (const key of Object.keys(held) as Key[]) held[key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const held = keys.current;
    if (held.turnLeft) camYaw.current -= TURN_RATE_RAD_S * dt;
    if (held.turnRight) camYaw.current += TURN_RATE_RAD_S * dt;

    const { dx, dz } = moveFromInput(held, camYaw.current, WALK_SPEED_MPS * dt);
    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      pos.current = moveWalker(pos.current, dx, dz, solids, half);
      heading.current = lerpAngle(heading.current, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));
      facing.current = facingFor(dx, dz);
      // Walking straight ahead lets the camera settle behind the player, as GTA does.
      if (held.forward && !held.left && !held.right && !held.back) {
        camYaw.current = lerpAngle(
          camYaw.current,
          heading.current + Math.PI,
          1 - Math.exp(-dt * 3),
        );
      }
    }

    const { x, z } = pos.current;
    const next: WalkView = {
      x,
      z,
      facing: facing.current,
      animation: moving ? "walk" : "idle",
    };
    const last = lastView.current;
    if (
      next.x !== last.x ||
      next.z !== last.z ||
      next.facing !== last.facing ||
      next.animation !== last.animation
    ) {
      lastView.current = next;
      setView(next);
    }

    const yaw = camYaw.current;
    wanted.set(
      x + Math.sin(yaw) * CAMERA_DISTANCE_M,
      CAMERA_HEIGHT_M,
      z + Math.cos(yaw) * CAMERA_DISTANCE_M,
    );
    if (placed.current) {
      camera.position.lerp(wanted, 1 - Math.exp(-dt * 6));
    } else {
      camera.position.copy(wanted);
      placed.current = true;
    }
    camera.lookAt(x, CAMERA_LOOK_Y_M, z);
  });

  const position = useMemo<[number, number, number]>(() => [view.x, 0, view.z], [view.x, view.z]);
  return (
    <group ref={root}>
      <WorldCharacter
        name="You"
        appearance={character.appearance ?? DEFAULT_APPEARANCE}
        gender={character.gender ?? "nonbinary"}
        equipment={character.equipment ?? NO_EQUIPMENT}
        position={position}
        facing={view.facing}
        animation={view.animation}
      />
    </group>
  );
}
