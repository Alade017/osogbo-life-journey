import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import {
  normalizeAvatarAppearance,
  SKIN_TONES,
  HAIR_COLORS,
  OUTFITS,
  TROUSERS,
  SHOE_COLORS,
  type Appearance,
} from "@/game/avatar-appearance";
import type { AvatarAnimationState, AvatarEquipment } from "@/components/game/Avatar";
import { WorldMaterial } from "./WorldScene";
import { WORLD_SCALE } from "./world-theme";
import { WORN_BOTTOMS, WORN_CLOTHING, WORN_ITEM_MODELS, WORN_SHOES } from "./world-item-models";
export type TaskPose = "sit" | "wash" | "cook" | "collect" | "stretch";

type ArmPose = (phase: number, side: number) => number;

export const ARM_POSES: Partial<Record<TaskPose, ArmPose>> = {
  sit: (p) => -0.2 + Math.sin(p * 0.5) * 0.05,
  wash: (p, s) => -1.5 + Math.sin(p) * 0.25 * s,
  collect: (p) => -0.9 + Math.sin(p) * 0.15,
  cook: (p, s) => -0.7 + Math.sin(p) * 0.25 * s,
  stretch: (p) => -2.2 + Math.sin(p * 0.5) * 0.3,
};

/** The same saved appearance contract is used by portraits and both world scenes. */
export function WorldCharacter({
  appearance = {},
  gender = "nonbinary",
  equipment = [],
  position,
  facing = "south",
  animation = "idle",
  name = "Resident",
  taskPose,
}: {
  appearance?: Appearance;
  gender?: string;
  equipment?: readonly AvatarEquipment[];
  position: [number, number, number];
  facing?: string;
  animation?: AvatarAnimationState;
  name?: string;
  taskPose?: TaskPose | undefined;
}) {
  const safe = normalizeAvatarAppearance(appearance, gender);
  const h = WORLD_SCALE.character * ([0.92, 1, 1.06][safe.stature] ?? 1);
  const build = [0.9, 1, 1.07, 1.14][safe.build] ?? 1;
  const arms = useRef<Group>(null),
    legs = useRef<Group>(null);
  const { invalidate } = useThree();
  const [reduced, setReduced] = useState(false);
  const last = useRef(position);
  const walkUntil = useRef(0);
  const [x, y, z] = position;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const moved = Math.hypot(x - last.current[0], z - last.current[2]) > 0.001;
    last.current = [x, y, z];
    if (moved) walkUntil.current = performance.now() + 350;
    if (reduced) return;
    const continuous = ["walk", "work", "talk"].includes(animation) || !!taskPose;
    if (!moved && !continuous) return;
    const timer = window.setInterval(() => {
      invalidate();
      if (!continuous && performance.now() > walkUntil.current) window.clearInterval(timer);
    }, 1000 / 15);
    return () => window.clearInterval(timer);
  }, [x, y, z, animation, taskPose, reduced, invalidate]);
  useFrame(({ clock }) => {
    if (!arms.current || !legs.current) return;
    const moving =
      animation !== "sleep" &&
      !taskPose &&
      (animation === "walk" || performance.now() < walkUntil.current);
    const phase = clock.elapsedTime * (moving ? 8 : 4);
    arms.current.children.forEach((part, index) => {
      const side = index % 2 ? 1 : -1;
      const pose = taskPose ? ARM_POSES[taskPose] : undefined;
      part.rotation.x = reduced
        ? 0
        : pose
          ? pose(phase, side)
          : moving
            ? Math.sin(phase) * 0.5 * side
            : animation === "work"
              ? -0.65 + Math.sin(phase) * 0.25
              : animation === "talk"
                ? -0.45 + Math.sin(phase) * 0.15
                : 0;
    });
    legs.current.children.forEach((part, index) => {
      part.rotation.x =
        taskPose === "sit"
          ? -Math.PI / 2
          : !reduced && moving
            ? Math.sin(phase) * 0.4 * (index % 2 ? 1 : -1)
            : 0;
    });
  });
  const skin = SKIN_TONES[safe.skin]!;
  const hair = HAIR_COLORS[safe.hairColor]!;
  const yaw =
    ({ north: Math.PI, east: Math.PI / 2, south: 0, west: -Math.PI / 2 } as Record<string, number>)[
      facing
    ] ?? 0;
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
  return (
    <group name={`character:${name}`} position={position} rotation={[0, yaw, 0]}>
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
        <mesh position={[0, h * 0.57, 0]} castShadow receiveShadow>
          <boxGeometry args={[h * 0.28, h * 0.36, h * 0.17]} />
          <WorldMaterial color={OUTFITS[safe.outfit]!} />
          {TopModel ? <TopModel h={h} /> : null}
          {BottomModel ? <BottomModel h={h} /> : null}
          {ShoesModel ? <ShoesModel h={h} /> : null}
        </mesh>
        <mesh position={[0, h * 0.79, 0]} castShadow>
          <cylinderGeometry args={[h * 0.055, h * 0.06, h * 0.08, 8]} />
          <WorldMaterial color={skin} />
        </mesh>
        <mesh position={[0, h * 0.9, 0]} castShadow>
          <sphereGeometry args={[h * 0.12, 12, 8]} />
          <WorldMaterial color={skin} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * h * 0.045, h * 0.91, h * 0.108]}>
            <sphereGeometry args={[h * 0.012, 6, 4]} />
            <WorldMaterial tone="timber" />
          </mesh>
        ))}
        {safe.hair !== 3 && (
          <mesh
            position={[0, h * 0.98, -h * 0.01]}
            scale={[1, safe.hair === 1 ? 1 : 0.45, 1]}
            castShadow
          >
            <sphereGeometry args={[h * 0.125, 10, 6]} />
            <WorldMaterial color={hair} />
          </mesh>
        )}
        {(safe.hair === 2 || safe.hair === 5) &&
          [-1, 1].map((side) => (
            <mesh key={side} position={[side * h * 0.1, h * 0.85, -h * 0.03]} castShadow>
              <boxGeometry args={[h * 0.05, h * 0.22, h * 0.08]} />
              <WorldMaterial color={hair} />
            </mesh>
          ))}
        {(safe.headwear > 0 || equipment.some((item) => item.slot === "head")) && (
          <mesh position={[0, h * 1.015, 0]} castShadow>
            <cylinderGeometry args={[h * 0.11, h * 0.14, h * 0.08, 10]} />
            <WorldMaterial color={OUTFITS[safe.outfit]!} />
          </mesh>
        )}
        <group ref={arms}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * h * 0.19, h * 0.71, 0]}>
              <mesh position={[0, -h * 0.13, 0]} castShadow>
                <boxGeometry args={[h * 0.085, h * 0.26, h * 0.1]} />
                <WorldMaterial color={OUTFITS[safe.outfit]!} />
              </mesh>
              <mesh position={[0, -h * 0.31, 0]} castShadow>
                <boxGeometry args={[h * 0.075, h * 0.13, h * 0.085]} />
                <WorldMaterial color={skin} />
              </mesh>
            </group>
          ))}
        </group>
        <group ref={legs}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * h * 0.075, h * 0.4, 0]}>
              <mesh position={[0, -h * 0.17, 0]} castShadow>
                <boxGeometry args={[h * 0.115, h * 0.34, h * 0.14]} />
                <WorldMaterial color={TROUSERS[safe.bottoms]!} />
              </mesh>
              <mesh position={[0, -h * 0.37, h * 0.035]} castShadow>
                <boxGeometry args={[h * 0.12, h * 0.06, h * 0.2]} />
                <WorldMaterial color={SHOE_COLORS[safe.shoes]!} />
              </mesh>
            </group>
          ))}
        </group>
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
  );
}
