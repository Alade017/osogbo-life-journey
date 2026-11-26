import {
  OUTFITS,
  SKIN_TONES,
  HAIR_STYLES_BY_GENDER,
  HAIR_COLORS,
  BODY_BUILDS,
  BODY_HEIGHTS,
  HEADWEAR,
  SHOE_COLORS,
  TROUSERS,
  normalizeAvatarAppearance,
  type Appearance,
} from "./avatar-appearance.ts";
import type { MallStaffRole } from "./osun-mall-layout.ts";

export type MallGender = "female" | "male";

/**
 * Shopper looks. Every value is a palette index, and each step changes the outfit and trousers
 * by a different amount, so neighbouring shoppers never share the same top or trousers.
 */
export function shopperLook(seed: number): { gender: MallGender; appearance: Appearance } {
  const gender: MallGender = seed % 2 ? "female" : "male";
  return {
    gender,
    appearance: normalizeAvatarAppearance(
      {
        clothed: true,
        skin: mod(seed + Math.floor(seed / 6), SKIN_TONES.length),
        hair: mod(Math.floor(seed / 2), HAIR_STYLES_BY_GENDER[gender]!.length),
        hairColor: mod(Math.floor(seed / 3), HAIR_COLORS.length),
        outfit: mod(seed * 5, OUTFITS.length),
        bottoms: mod(seed * 7 + 2, TROUSERS.length),
        shoes: mod(seed * 3, SHOE_COLORS.length),
        build: mod(Math.floor(seed / 2) + Math.floor(seed / 7), BODY_BUILDS.length),
        stature: mod(Math.floor(seed / 2) + seed, BODY_HEIGHTS.length),
        headwear: mod(seed, 5) === 0 ? 1 + mod(Math.floor(seed / 5), HEADWEAR.length - 1) : 0,
      },
      gender,
    ),
  };
}

/** Staff wear a uniform for their role, so they read as staff rather than shoppers. */
const UNIFORMS: Record<MallStaffRole, { outfit: number; bottoms: number }> = {
  till: { outfit: 3, bottoms: 1 },
  floor: { outfit: 1, bottoms: 0 },
  security: { outfit: 5, bottoms: 1 },
  supervisor: { outfit: 2, bottoms: 0 },
  "staff-room": { outfit: 0, bottoms: 2 },
  "control-room": { outfit: 0, bottoms: 2 },
};

export function staffLook(
  role: MallStaffRole,
  index: number,
): { gender: MallGender; appearance: Appearance } {
  const gender: MallGender = index % 2 ? "female" : "male";
  const uniform = UNIFORMS[role];
  return {
    gender,
    appearance: normalizeAvatarAppearance(
      {
        clothed: true,
        skin: mod(index * 5 + 1, 6),
        hair: mod(index, 4),
        hairColor: mod(index * 3, 4),
        outfit: uniform.outfit,
        bottoms: uniform.bottoms,
        shoes: 0,
        build: mod(index + 1, 4),
        stature: 1,
      },
      gender,
    ),
  };
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
