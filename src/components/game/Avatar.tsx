import type { ReactNode } from "react";

// Original OSOGBO LIFE toy-brick character options. Keep these indices stable:
// saved characters in Supabase refer to them by index.
export const SKIN_TONES = ["#5a3825", "#6e452c", "#8a5a3b", "#a56f48", "#c28a5e", "#3f2618"];
export const HAIR_STYLES_BY_GENDER: Record<string, string[]> = {
  female: ["Low bun", "Natural afro", "Knotless braids", "Bald", "Bantu knots", "Locs"],
  male: ["Low fade", "Short afro", "Cornrows", "Bald", "Wave cut", "Locs"],
  nonbinary: ["Taper fade", "Natural afro", "Braids", "Bald", "Twist-out", "Locs"],
};
export const HAIR_STYLES = HAIR_STYLES_BY_GENDER["female"];
export const HAIR_COLORS = ["#1b1410", "#3b2416", "#6b3d1f", "#8c8c8c"];
export const OUTFITS = ["#2f9e5b", "#e8b422", "#d0623a", "#3b5bb5", "#9b3f8f", "#2b2f3a"];
export const TROUSERS = ["#27334a", "#20242c", "#614b3b", "#738095", "#3b5bb5", "#547250"];
export const SHOE_COLORS = ["#22242a", "#5b3526", "#eee5d5", "#b34535"];
export const HEADWEAR = ["None", "Gele", "Fila", "Cap"];

export type Appearance = {
  skin?: number;
  hair?: number;
  hairColor?: number;
  outfit?: number;
  bottoms?: number;
  shoes?: number;
  headwear?: number;
};
export type AvatarEquipment = { slot: string };
export type AvatarFacing = "north" | "east" | "south" | "west";
export type AvatarAnimationState = "idle" | "walk" | "turn" | "talk" | "work";

export const AVATAR_VIEWBOX = { width: 64, height: 80 } as const;
const DEFAULT_APPEARANCE: Required<Appearance> = {
  skin: 1,
  hair: 1,
  hairColor: 0,
  outfit: 0,
  bottoms: 0,
  shoes: 0,
  headwear: 0,
};
const EDGE = "#17231f";
const SAFE_HAIR = HAIR_STYLES_BY_GENDER["nonbinary"]!;

function validIndex(value: number | undefined, choices: readonly unknown[], fallback: number) {
  return Number.isInteger(value) && value! >= 0 && value! < choices.length ? value! : fallback;
}

/** Normalize old, partial or future appearance data at the rendering boundary. */
export function normalizeAvatarAppearance(
  appearance: Appearance | null | undefined,
  gender = "nonbinary",
): Required<Appearance> {
  const hairOptions = HAIR_STYLES_BY_GENDER[gender] ?? SAFE_HAIR;
  return {
    skin: validIndex(appearance?.skin, SKIN_TONES, DEFAULT_APPEARANCE.skin),
    hair: validIndex(appearance?.hair, hairOptions, DEFAULT_APPEARANCE.hair),
    hairColor: validIndex(appearance?.hairColor, HAIR_COLORS, DEFAULT_APPEARANCE.hairColor),
    outfit: validIndex(appearance?.outfit, OUTFITS, DEFAULT_APPEARANCE.outfit),
    bottoms: validIndex(appearance?.bottoms, TROUSERS, DEFAULT_APPEARANCE.bottoms),
    shoes: validIndex(appearance?.shoes, SHOE_COLORS, DEFAULT_APPEARANCE.shoes),
    headwear: validIndex(appearance?.headwear, HEADWEAR, DEFAULT_APPEARANCE.headwear),
  };
}

function poseFor(state: AvatarAnimationState, frame: number) {
  const index = Number.isFinite(frame) ? Math.abs(Math.floor(frame)) : 0;
  const walk = [-1, 1, 1, -1][index % 4]!;
  const work = [-1, 0, 1, 0][index % 4]!;
  if (state === "walk") return { bob: index % 2 ? -1 : 1, arm: walk * 22, leg: walk * 16, lean: 0 };
  if (state === "work") return { bob: index % 2 ? -1 : 0, arm: work * 34, leg: 0, lean: work * 2 };
  if (state === "talk") return { bob: 0, arm: index % 2 ? -18 : -30, leg: 0, lean: 0 };
  if (state === "turn") return { bob: 0, arm: index % 2 ? 8 : -8, leg: 0, lean: 0 };
  return { bob: index % 2 ? -1 : 0, arm: 0, leg: 0, lean: 0 };
}

/** Shared artwork used by React portraits and the one-time Phaser sprite atlas. */
export function AvatarArtwork({
  appearance,
  gender = "nonbinary",
  equipment = [],
  animationState = "idle",
  animationFrame = 0,
  facing = "south",
  width = 96,
  height = (width * AVATAR_VIEWBOX.height) / AVATAR_VIEWBOX.width,
  x,
  y,
}: {
  appearance: Appearance;
  gender?: string;
  equipment?: readonly AvatarEquipment[];
  animationState?: AvatarAnimationState;
  animationFrame?: number;
  facing?: AvatarFacing;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}): ReactNode {
  const safe = normalizeAvatarAppearance(appearance, gender);
  const skin = SKIN_TONES[safe.skin]!;
  const hairColor = HAIR_COLORS[safe.hairColor]!;
  const shirt = OUTFITS[safe.outfit]!;
  const pants = TROUSERS[safe.bottoms]!;
  const shoes = SHOE_COLORS[safe.shoes]!;
  const hair = safe.hair;
  const worn = new Set(equipment.map((item) => item.slot));
  const pose = poseFor(animationState, animationFrame);
  const mirrored = facing === "west";
  const directionTransform = mirrored ? "translate(64 0) scale(-1 1)" : undefined;
  const eyeFill = facing === "north" ? "none" : EDGE;
  const sideFacing = facing === "east" || facing === "west";
  const leftArm = animationState === "talk" || animationState === "work" ? pose.arm : pose.arm;
  const rightArm = animationState === "talk" ? pose.arm - 18 : -pose.arm;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      x={x}
      y={y}
      viewBox={`0 0 ${AVATAR_VIEWBOX.width} ${AVATAR_VIEWBOX.height}`}
      width={width}
      height={height}
      aria-hidden="true"
      data-avatar-state={animationState}
      data-avatar-facing={facing}
      shapeRendering="geometricPrecision"
    >
      <ellipse cx="32" cy="74" rx="17" ry="4" fill="#17231f" opacity=".2" />
      <g transform={directionTransform}>
        <g transform={`translate(0 ${pose.bob}) rotate(${pose.lean} 32 48)`}>
          {/* Legs pivot independently to make the walk and generic work cycles legible. */}
          <g transform={`rotate(${pose.leg} 27 60)`}>
            <path d="M22 54h10v14q0 3-3 3h-5q-2 0-2-3z" fill={pants} stroke={EDGE} strokeWidth="1.7" />
            <path d="M22 68h11v5q0 2-3 2H20q-2 0-1-3z" fill={shoes} stroke={EDGE} strokeWidth="1.7" />
          </g>
          <g transform={`rotate(${-pose.leg} 38 60)`}>
            <path d="M33 54h10v14q0 3-3 3h-5q-2 0-2-3z" fill={pants} stroke={EDGE} strokeWidth="1.7" />
            <path d="M33 68h11v5q0 2-3 2H31q-2 0-1-3z" fill={shoes} stroke={EDGE} strokeWidth="1.7" />
          </g>
          {/* Rounded limbs and a shaped tunic keep the toy-brick silhouette soft at small sizes. */}
          <g transform={`rotate(${leftArm} 18 44)`}>
            <path d="M17 39q-4 0-5 5l-2 10q-1 4 3 5t5-4l3-10q1-5-4-6z" fill={shirt} stroke={EDGE} strokeWidth="1.8" />
            <circle cx="13" cy="58" r="3.2" fill={skin} stroke={EDGE} strokeWidth="1.4" />
          </g>
          <g transform={`rotate(${rightArm} 46 44)`}>
            <path d="M47 39q4 0 5 5l2 10q1 4-3 5t-5-4l-3-10q-1-5 4-6z" fill={shirt} stroke={EDGE} strokeWidth="1.8" />
            <circle cx="51" cy="58" r="3.2" fill={skin} stroke={EDGE} strokeWidth="1.4" />
          </g>
          <path d="M24 34h16q5 0 7 5l3 14q1 4-4 5H18q-5-1-4-5l3-14q2-5 7-5z" fill={shirt} stroke={EDGE} strokeWidth="2" />
          <path d="M29 31h6v5h-6z" fill={skin} stroke={EDGE} strokeWidth="1.4" />
          {worn.has("top") && (
            <g data-equipment-slot="top" pointerEvents="none">
              <path d="M20 39h5v14h-5z" fill="#f4d28d" opacity=".9" />
              <circle cx="22.5" cy="42" r=".8" fill={EDGE} />
              <circle cx="22.5" cy="46" r=".8" fill={EDGE} />
            </g>
          )}
          {worn.has("bottom") && <path data-equipment-slot="bottom" d="M24 58v9" stroke="#d39a42" strokeWidth="2.5" />}
          {worn.has("shoes") && <path data-equipment-slot="shoes" d="M21 72h5m11 0h5" stroke="#f4d28d" strokeWidth="1.5" />}
          {worn.has("accessory") && (
            <g data-equipment-slot="accessory" stroke={EDGE} strokeWidth="1.5">
              <path d="m10 39 5-3 4 4-4 15-6-2z" fill="#d39a42" />
              <path d="m12 40 4 2" stroke="#f4d28d" />
            </g>
          )}
          {/* Back view shows hair and outfit details without a front-facing expression. */}
          <path d="M21 20q-1-14 11-14t11 14v8q-2 8-11 8t-11-8z" fill={skin} stroke={EDGE} strokeWidth="2" />
          {hair === 1 && <path d="M18 20q0-18 14-18t14 18q-5-5-14-5t-14 5z" fill={hairColor} stroke={EDGE} strokeWidth="2" />}
          {hair === 2 && (
            <g fill="none" stroke={hairColor} strokeWidth="3.5" strokeLinecap="round">
              <path d="M22 11q-4 8 0 19l3 5M29 7q-2 12 2 25l2 5M38 8q4 10 0 25l-2 4" />
            </g>
          )}
          {hair === 3 && null}
          {hair === 4 && <g fill={hairColor} stroke={EDGE} strokeWidth="1.3"><circle cx="23" cy="9" r="4"/><circle cx="32" cy="5" r="4"/><circle cx="41" cy="9" r="4"/></g>}
          {hair === 5 && (
            <g fill={hairColor} stroke={EDGE} strokeWidth="1.3">
              <path d="M20 13q-3 1-2 13t4 1q1-10 0-14z"/><path d="M27 8q-3 1-2 22t4 1q1-17 0-22z"/><path d="M38 8q3 1 2 22t-4 1q-1-17 0-22z"/><path d="M44 13q3 1 2 13t-4 1q-1-10 0-14z"/>
            </g>
          )}
          {hair === 0 && <path d="M20 17q2-12 12-12t12 12q-5-5-12-5t-12 5z" fill={hairColor} stroke={EDGE} strokeWidth="2" />}
          {facing !== "north" && (
            <g>
              <path d={sideFacing ? "M37 20q3 1 3 4" : "M26 21q2-2 4 0"} fill="none" stroke={EDGE} strokeWidth="1.6" strokeLinecap="round" />
              {!sideFacing && <path d="M34 21q2-2 4 0" fill="none" stroke={EDGE} strokeWidth="1.6" strokeLinecap="round" />}
              {animationState === "talk" ? (
                <ellipse cx={sideFacing ? 39 : 32} cy="28" rx="2.3" ry={animationFrame % 2 ? 2.5 : 1.2} fill={EDGE} />
              ) : (
                <path d={sideFacing ? "M36 29q2 2 4 0" : "M27 29q5 4 10 0"} fill="none" stroke={EDGE} strokeWidth="1.4" strokeLinecap="round" />
              )}
            </g>
          )}
          {safe.headwear === 1 && (
            <path d="M17 16q4-13 15-13t15 13q-8-4-15-2t-15 2z" fill={shirt} stroke={EDGE} strokeWidth="2" />
          )}
          {safe.headwear === 2 && <path d="m21 10 3-6h17l3 8q-11-4-23-2z" fill={shirt} stroke={EDGE} strokeWidth="2" />}
          {safe.headwear === 3 && <path d="M20 14q1-12 12-12t12 12H20zm18-1h10v3H38z" fill={shirt} stroke={EDGE} strokeWidth="2" />}
          {worn.has("head") && <path data-equipment-slot="head" d="M19 14q2-10 13-10t13 10q-13-4-26 0z" fill="#d39a42" stroke={EDGE} strokeWidth="1.8" />}
          <rect x="27" y="1.5" width="10" height="4" rx="1.8" fill={skin} stroke={EDGE} strokeWidth="1.5" />
        </g>
      </g>
      {facing === "north" && <path d="M26 26q6 4 12 0" fill="none" stroke={eyeFill} strokeWidth="1.2" />}
    </svg>
  );
}

export function Avatar({
  appearance,
  gender = "nonbinary",
  size = 96,
  equipment = [],
  animationState = "idle",
  animationFrame = 0,
  facing = "south",
}: {
  appearance: Appearance;
  gender?: string;
  size?: number;
  equipment?: readonly AvatarEquipment[];
  animationState?: AvatarAnimationState;
  animationFrame?: number;
  facing?: AvatarFacing;
}) {
  return (
    <AvatarArtwork
      appearance={appearance}
      gender={gender}
      width={size}
      height={(size * AVATAR_VIEWBOX.height) / AVATAR_VIEWBOX.width}
      equipment={equipment}
      animationState={animationState}
      animationFrame={animationFrame}
      facing={facing}
    />
  );
}
