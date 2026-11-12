import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3, type Group } from "three";
import {
  normalizeAvatarAppearance,
  OUTFITS,
  SKIN_TONES,
  type Appearance,
} from "@/game/avatar-appearance";
import type { AvatarAnimationState, AvatarEquipment } from "@/components/game/Avatar";
import { WorldMaterial } from "./WorldScene";
import { WORLD_SCALE } from "./world-theme";
import {
  CHARACTER_CLOTH,
  rightHandPoint,
  CHARACTER_GROUND,
  CHARACTER_MOTION,
  CHARACTER_SOCKETS,
} from "./character-config";
import { adireTexture } from "./cloth-patterns";
import { bodyVariantFor, CharacterBody, type BodyVariant } from "./CharacterBody";
import { WORN_BOTTOMS, WORN_CLOTHING, WORN_ITEM_MODELS, WORN_SHOES } from "./world-item-models";

export type TaskPose = "sit" | "wash" | "cook" | "collect" | "stretch";

const blend = (rate: number, delta: number) => 1 - Math.exp(-rate * delta);

const FACING_YAW: Record<string, number> = {
  north: Math.PI,
  east: Math.PI / 2,
  south: 0,
  west: -Math.PI / 2,
};

/**
 * The same saved appearance contract is used by portraits and both world scenes. The body is a
 * single mesh, so limbs do not swing separately: walking bobs the whole figure and the head
 * glance turns the body as one.
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
  /** Something carried in the right hand, such as a package. Follows the body. */
  held?: ReactNode;
  /** Forces a specific body, such as the delivery courier. Defaults from the saved gender. */
  body?: BodyVariant | undefined;
}) {
  const safe = normalizeAvatarAppearance(appearance, gender);
  const h = WORLD_SCALE.character * ([0.92, 1, 1.06][safe.stature] ?? 1);
  const build = [0.9, 1, 1.07, 1.14][safe.build] ?? 1;
  const bodyRef = useRef<Group>(null);
  const { invalidate } = useThree();
  const [reduced, setReduced] = useState(false);
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
    if (moved) walkUntil.current = performance.now() + 350;
    if (reduced) return;
    const continuous = ["walk", "work", "talk", "interact"].includes(animation) || !!taskPose;
    const turning = !!lookKey;
    if (!moved && !continuous && !turning) return;
    const settleUntil = performance.now() + CHARACTER_MOTION.settleSeconds * 1000;
    const timer = window.setInterval(() => {
      invalidate();
      const active = continuous || performance.now() < Math.max(walkUntil.current, settleUntil);
      if (!active) window.clearInterval(timer);
    }, 1000 / 15);
    return () => window.clearInterval(timer);
  }, [x, y, z, animation, taskPose, reduced, invalidate, lookKey]);
  const yaw = FACING_YAW[facing] ?? 0;
  useFrame(({ clock }, delta) => {
    const rootGroup = root.current;
    if (rootGroup && rootGroup.position.distanceTo(goal.current) > 0.001) {
      rootGroup.position.lerp(goal.current, 1 - Math.exp(-CHARACTER_MOTION.glideRate * delta));
      if (rootGroup.position.distanceTo(goal.current) <= 0.001)
        rootGroup.position.copy(goal.current);
      invalidate();
    }
    const group = bodyRef.current;
    if (!group) return;
    const moving =
      animation !== "sleep" &&
      !taskPose &&
      (animation === "walk" || performance.now() < walkUntil.current);
    const phase = clock.elapsedTime * (moving ? 8 : 4);
    // Poses are blended toward their targets so changes fade rather than snap.
    const k = reduced ? 1 : blend(CHARACTER_MOTION.fadeRate, delta);
    // Footfall: the body rises mid-stride and squashes slightly as each foot lands.
    const footfall = reduced || !moving ? 0 : Math.abs(Math.sin(phase));
    group.position.y = MathUtils.lerp(group.position.y, footfall * CHARACTER_MOTION.bob * h, k);
    group.scale.y = MathUtils.lerp(group.scale.y, 1 - footfall * CHARACTER_MOTION.squash, k);
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
  const skin = SKIN_TONES[safe.skin]!;
  const bodyVariant = body ?? bodyVariantFor(gender);
  const wornAccessory = equipment.find((item) => item.slot === "accessory") as
    { item?: { slug?: string } | null } | undefined;
  const AccessoryModel = wornAccessory?.item?.slug
    ? WORN_ITEM_MODELS[wornAccessory.item.slug]
    : undefined;
  const wornTop = equipment.find((item) => item.slot === "top") as
    { item?: { slug?: string | null } | null } | undefined;
  const TopModel = wornTop?.item?.slug ? WORN_CLOTHING[wornTop.item.slug] : undefined;
  const wornBottom = equipment.find((item) => item.slot === "bottom") as
    { item?: { slug?: string | null } | null } | undefined;
  const BottomModel = wornBottom?.item?.slug ? WORN_BOTTOMS[wornBottom.item.slug] : undefined;
  const wornShoes = equipment.find((item) => item.slot === "shoes") as
    { item?: { slug?: string | null } | null } | undefined;
  const ShoesModel = wornShoes?.item?.slug ? WORN_SHOES[wornShoes.item.slug] : undefined;
  const clothMap = CHARACTER_CLOTH.patternedOutfits.includes(safe.outfit) ? adireTexture() : null;
  const clothColor = clothMap ? "#ffffff" : OUTFITS[safe.outfit]!;
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
          <CharacterBody
            variant={bodyVariant}
            height={h}
            skin={bodyVariant === "courier" ? undefined : skin}
          />
          <group name="torso_socket" position={[0, h * 0.52, 0]}>
            {TopModel ? <TopModel h={h} /> : null}
            {BottomModel ? <BottomModel h={h} /> : null}
            {ShoesModel ? <ShoesModel h={h} /> : null}
          </group>
          <group name="head_socket" position={[0, h * CHARACTER_SOCKETS.head, 0]}>
            {(safe.headwear > 0 || equipment.some((item) => item.slot === "head")) && (
              <mesh castShadow>
                <cylinderGeometry args={[h * 0.15, h * 0.17, h * 0.08, 8]} />
                <WorldMaterial color={clothColor} map={clothMap} />
              </mesh>
            )}
          </group>
          {held ? (
            <group name="right_hand_socket" position={rightHandPoint(h)}>
              {held}
            </group>
          ) : null}
          <group name="back_socket" position={[0, h * CHARACTER_SOCKETS.back, 0]}>
            {AccessoryModel ? (
              <AccessoryModel h={h} />
            ) : equipment.some((item) => item.slot === "accessory") ? (
              <mesh position={[h * 0.22, h * 0.48, 0]} castShadow>
                <boxGeometry args={[h * 0.12, h * 0.16, h * 0.14]} />
                <WorldMaterial tone="timber" />
              </mesh>
            ) : null}
          </group>
        </group>
      </group>
    </group>
  );
}
