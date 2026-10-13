// Keep these palette indices stable; saved characters refer to them in Supabase.
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

const DEFAULT_APPEARANCE: Required<Appearance> = {
  skin: 1,
  hair: 1,
  hairColor: 0,
  outfit: 0,
  bottoms: 0,
  shoes: 0,
  headwear: 0,
};
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
