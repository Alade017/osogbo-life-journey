import {
  HAIR_COLORS,
  normalizeAvatarAppearance,
  OUTFITS,
  SKIN_TONES,
  type Appearance,
} from "@/game/avatar-appearance";
import type { CharacterAppearance3D } from "@/types/models";

const HAIR_STYLES: readonly CharacterAppearance3D["hairStyle"][] = [
  "short",
  "afro",
  "braids",
  "bald",
  "braids",
  "locs",
];

/** Translate stable saved appearance indices into the color/style API used by 3D models. */
export function characterAppearance3D(
  appearance: Appearance | null | undefined,
  gender = "nonbinary",
): CharacterAppearance3D {
  const normalized = normalizeAvatarAppearance(appearance, gender);
  return {
    skinTone: SKIN_TONES[normalized.skin]!,
    hairColor: HAIR_COLORS[normalized.hairColor]!,
    hairStyle: HAIR_STYLES[normalized.hair] ?? "short",
    outfitColor: OUTFITS[normalized.outfit]!,
  };
}
