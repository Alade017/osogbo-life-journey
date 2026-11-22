import {
  resolveEquippedHeadwear,
  resolveNormalizedWornOutfit,
} from "@/game/wearable-outfits";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3, type Group } from "three";
import { normalizeAvatarAppearance, type Appearance } from "@/game/avatar-appearance";
import type { AvatarAnimationState, AvatarEquipment } from "@/components/game/Avatar";
import { WORLD_SCALE } from "./world-theme";
import { CHARACTER_GROUND, CHARACTER_MOTION } from "./character-config";
import { bodyVariantFor, CharacterBody, motionFor, type BodyVariant } from "./CharacterBody";
import { followStep, measuredSpeed, walkingCadence, type Vec3 } from "./character-follow";
import { WORN_ITEM_MODELS } from "./world-item-models";

export type TaskPose = "sit" | "wash" | "cook" | "collect" | "stretch";

const blend = (rate: number, delta: number) => 1 - Math.exp(-rate * delta);

const FACING_YAW: Record<string, number> = {
  north: Math.PI,
  east: Math.PI / 2,
  south: 0,
  west: -Math.PI / 2,
};

/**
 * Portraits and world scenes share the same saved skin, hair, fitted outfit and proportions.
 * Stable biped bones preserve every task pose, held item and equipment socket.
 */
export function WorldCharacter({
  appearance = {},
  gender = "nonbinary",
  equipment = [],
  position,
  facing = "south",
  animation = "idle",
  name = "Resident",
  taskPose,
  lookAt = null,
  held = null,
  body,
}: {
  appearance?: Appearance;
  gender?: string;
  equipment?: readonly AvatarEquipment[];
  position: [number, number, number];
  facing?: string;
  /** "interact" reaches forward with the right hand; the others match the 2D avatar states. */
  animation?: AvatarAnimationState | "interact";
  name?: string;
  taskPose?: TaskPose | undefined;
  /** World point to turn toward, such as a nearby character. */
  lookAt?: readonly [number, number, number] | null;
  /** Something carried in the right hand, such as a package. Follows the hand bone. */
  held?: ReactNode;
  /** Forces a specific body, such as the bank staff body. Defaults from the saved gender. */
  body?: BodyVariant | undefined;
}) {
  const safe = normalizeAvatarAppearance(appearance, gender);
  const outfit = resolveNormalizedWornOutfit(safe, equipment);
  // Only inventory items with a supported 3D headwear model render on the rig.
  safe.headwear = resolveEquippedHeadwear(equipment);
  if (outfit.hasWearables) safe.clothed = true;
  const h = WORLD_SCALE.character * ([0.92, 1, 1.06][safe.stature] ?? 1);
  const variant = body ?? bodyVariantFor(gender);
  const bodyRef = useRef<Group>(null);
  const { invalidate } = useThree();
  const [reduced, setReduced] = useState(false);
  const [walking, setWalking] = useState(false);
  const cadence = useRef(1);
  const walkingRef = useRef(false);
  // The root glides toward `position` each frame, so a new spot is walked to rather than jumped to.
  const root = useRef<Group>(null);
  const goal = useRef<Vector3 | null>(null);
  const goalPosition =
    goal.current ?? (goal.current = new Vector3(...position));
  const [movementBuffers] = useState(() => ({
    current: [0, 0, 0] as Vec3,
    goal: [0, 0, 0] as Vec3,
    output: [0, 0, 0] as Vec3,
  }));
  // Speed of the server's last update, so the glide keeps pace with the walk rather than easing off.
  const speed = useRef(0);
  const updateAt = useRef(performance.now());
  const previousGoal = useRef<Vec3>(position);
  const [x, y, z] = position;
  if (
    previousGoal.current[0] !== x ||
    previousGoal.current[1] !== y ||
    previousGoal.current[2] !== z
  ) {
    const now = performance.now();
    speed.current = measuredSpeed(previousGoal.current, position, (now - updateAt.current) / 1000);
    updateAt.current = now;
    previousGoal.current = position;
  }
  goalPosition.set(x, y, z);
  useLayoutEffect(() => {
    root.current?.position.copy(goalPosition);
  }, [goalPosition]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const lookKey = lookAt ? lookAt.map((value) => value.toFixed(2)).join(":") : "";
  useEffect(() => {
    invalidate();
  }, [lookKey, invalidate]);
  useEffect(() => {
    if (reduced && walkingRef.current) {
      walkingRef.current = false;
      setWalking(false);
    }
    invalidate();
  }, [x, y, z, animation, taskPose, reduced, invalidate]);
  const yaw = FACING_YAW[facing] ?? 0;
  const initialYaw = useRef(yaw);
  useEffect(() => { invalidate(); }, [yaw, invalidate]);
  useFrame((_state, delta) => {
    const rootGroup = root.current;
    if (rootGroup) {
      const difference = Math.atan2(Math.sin(yaw - rootGroup.rotation.y), Math.cos(yaw - rootGroup.rotation.y));
      if (Math.abs(difference) > 0.002) {
        rootGroup.rotation.y += reduced ? difference : difference * blend(CHARACTER_MOTION.headTurnRate, delta);
        invalidate();
      } else rootGroup.rotation.y = yaw;
    }
    let travelled = 0;
    if (rootGroup && rootGroup.position.distanceTo(goalPosition) > 0.001) {
      const here = rootGroup.position;
      const currentCoords = movementBuffers.current;
      currentCoords[0] = here.x;
      currentCoords[1] = here.y;
      currentCoords[2] = here.z;

      const goalCoords = movementBuffers.goal;
      goalCoords[0] = goalPosition.x;
      goalCoords[1] = goalPosition.y;
      goalCoords[2] = goalPosition.z;

      const [nx, ny, nz] = followStep(
        currentCoords,
        goalCoords,
        delta,
        speed.current,
        CHARACTER_MOTION.glideRate,
        movementBuffers.output,
      );
      travelled = Math.hypot(nx - here.x, nz - here.z);
      rootGroup.position.set(nx, ny, nz);
      invalidate();
    }
    const travelling = !reduced && travelled > 0;
    cadence.current = travelling ? walkingCadence(travelled, delta, h) : animation === "walk" ? 1 : 0;
    if (walkingRef.current !== travelling) {
      walkingRef.current = travelling;
      setWalking(travelling);
      invalidate();
    }
    const group = bodyRef.current;
    if (!group) return;
    // A look at a nearby character turns the body a little, measured relative to its facing.
    let turn = 0;
    if (lookAt && !reduced) {
      const worldYaw = Math.atan2(lookAt[0] - x, lookAt[2] - z);
      const limit = CHARACTER_MOTION.headTurnLimit * 0.5;
      const difference = worldYaw - (rootGroup?.rotation.y ?? yaw);
      turn = MathUtils.clamp(Math.atan2(Math.sin(difference), Math.cos(difference)), -limit, limit);
    }
    if (Math.abs(group.rotation.y - turn) > 0.002) {
      group.rotation.y = MathUtils.lerp(
        group.rotation.y,
        turn,
        blend(CHARACTER_MOTION.headTurnRate, delta),
      );
      if (Math.abs(group.rotation.y - turn) <= 0.002) {
        group.rotation.y = turn;
      }
      invalidate();
    }
  });
  const moving = walking && !reduced && !taskPose;
  const motion = motionFor(reduced && animation === "walk" ? "idle" : animation, moving, taskPose);
  const wornAccessory = equipment.find((item) => item.slot === "accessory") as
    { item?: { slug?: string } | null } | undefined;
  const AccessoryModel = wornAccessory?.item?.slug
    ? WORN_ITEM_MODELS[wornAccessory.item.slug]
    : undefined;
  return (
    <group ref={root} name={`character:${name}`} rotation={[0, initialYaw.current, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={-1}>
        <circleGeometry args={[h * CHARACTER_GROUND.shadowRadius, 20]} />
        <meshBasicMaterial
          color={CHARACTER_GROUND.shadowColor}
          transparent
          opacity={CHARACTER_GROUND.shadowOpacity}
          depthWrite={false}
        />
      </mesh>
      <group
        position={
          animation === "sleep"
            ? [0, 0.5, h * 0.5]
            : taskPose === "sit"
              ? [0, -h * 0.24, 0]
              : [0, 0, 0]
        }
        rotation={[animation === "sleep" ? -Math.PI / 2 : 0, 0, 0]}
      >
        <group ref={bodyRef}>
          <CharacterBody
            outfit={outfit}
            variant={variant}
            height={h}
            motion={motion}
            animated={!reduced}
            walkCadence={cadence}
            held={held}
            backAccessory={AccessoryModel ? <AccessoryModel h={1} /> : null}
            appearance={safe}
            gender={gender}
          />
        </group>
      </group>
    </group>
  );
}
