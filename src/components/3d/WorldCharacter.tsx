import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3, type Group } from "three";
import { normalizeAvatarAppearance, type Appearance } from "@/game/avatar-appearance";
import type { AvatarAnimationState, AvatarEquipment } from "@/components/game/Avatar";
import { WORLD_SCALE } from "./world-theme";
import { CHARACTER_GROUND, CHARACTER_MOTION, CHARACTER_SOCKETS } from "./character-config";
import { bodyVariantFor, CharacterBody, motionFor, type BodyVariant } from "./CharacterBody";
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
 * The same saved appearance contract is used by portraits and both world scenes. Bodies are
 * rigged adults with their own clothing and hair, so the saved outfit, hair and skin options no
 * longer change the body; height and build still scale it.
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
  const h = WORLD_SCALE.character * ([0.92, 1, 1.06][safe.stature] ?? 1);
  const build = [0.9, 1, 1.07, 1.14][safe.build] ?? 1;
  const variant = body ?? bodyVariantFor(gender);
  const bodyRef = useRef<Group>(null);
  const { invalidate } = useThree();
  const [reduced, setReduced] = useState(false);
  const [walking, setWalking] = useState(false);
  const last = useRef(position);
  const walkUntil = useRef(0);
  // The root glides toward `position` each frame, so a new spot is walked to rather than jumped to.
  const root = useRef<Group>(null);
  const goal = useRef(new Vector3(...position));
  const [x, y, z] = position;
  goal.current.set(x, y, z);
  useLayoutEffect(() => {
    root.current?.position.copy(goal.current);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const lookKey = lookAt ? lookAt.map((value) => value.toFixed(2)).join(":") : "";
  useEffect(() => {
    const moved = Math.hypot(x - last.current[0], z - last.current[2]) > 0.001;
    last.current = [x, y, z];
    if (moved) {
      walkUntil.current = performance.now() + 350;
      setWalking(true);
    }
    if (reduced) return;
    const continuous =
      animation === "walk" ||
      animation === "work" ||
      animation === "talk" ||
      animation === "interact" ||
      !!taskPose;
    if (!moved && !continuous && !walking && !lookKey) return;
    const settleUntil = performance.now() + CHARACTER_MOTION.settleSeconds * 1000;
    const timer = window.setInterval(() => {
      invalidate();
      if (performance.now() >= walkUntil.current) setWalking(false);
      const active = continuous || performance.now() < Math.max(walkUntil.current, settleUntil);
      if (!active) window.clearInterval(timer);
    }, 1000 / 15);
    return () => window.clearInterval(timer);
  }, [x, y, z, animation, taskPose, reduced, invalidate, lookKey, walking]);
  const yaw = FACING_YAW[facing] ?? 0;
  useFrame((_state, delta) => {
    const rootGroup = root.current;
    if (rootGroup && rootGroup.position.distanceTo(goal.current) > 0.001) {
      rootGroup.position.lerp(goal.current, 1 - Math.exp(-CHARACTER_MOTION.glideRate * delta));
      if (rootGroup.position.distanceTo(goal.current) <= 0.001)
        rootGroup.position.copy(goal.current);
      invalidate();
    }
    const group = bodyRef.current;
    if (!group) return;
    // A look at a nearby character turns the body a little, measured relative to its facing.
    let turn = 0;
    if (lookAt && !reduced) {
      const worldYaw = Math.atan2(lookAt[0] - x, lookAt[2] - z);
      const limit = CHARACTER_MOTION.headTurnLimit * 0.5;
      turn = MathUtils.clamp(worldYaw - yaw, -limit, limit);
    }
    group.rotation.y = MathUtils.lerp(
      group.rotation.y,
      turn,
      blend(CHARACTER_MOTION.headTurnRate, delta),
    );
  });
  const moving = walking && !reduced && !taskPose;
  const motion = motionFor(animation, moving);
  const wornAccessory = equipment.find((item) => item.slot === "accessory") as
    { item?: { slug?: string } | null } | undefined;
  const AccessoryModel = wornAccessory?.item?.slug
    ? WORN_ITEM_MODELS[wornAccessory.item.slug]
    : undefined;
  return (
    <group ref={root} name={`character:${name}`} rotation={[0, yaw, 0]}>
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
        scale={[build, 1, 1]}
      >
        <group ref={bodyRef}>
          <CharacterBody variant={variant} height={h} motion={motion} held={held} />
          <group name="back_socket" position={[0, h * CHARACTER_SOCKETS.back, 0]}>
            {AccessoryModel ? <AccessoryModel h={h} /> : null}
          </group>
        </group>
      </group>
    </group>
  );
}
