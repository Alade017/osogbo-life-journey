import {
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  HEADWEAR,
  OUTFITS,
  SHOE_COLORS,
  SKIN_TONES,
  TROUSERS,
  type Appearance,
} from "@/components/game/Avatar";

export type CharacterAppearance = Required<Appearance>;

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  skin: 1,
  hair: 1,
  hairColor: 0,
  outfit: 0,
  bottoms: 0,
  shoes: 0,
  headwear: 0,
};

export function appearanceForGender(
  appearance: CharacterAppearance,
  gender: string,
): CharacterAppearance {
  const styles = HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["nonbinary"] ?? [];
  return {
    ...appearance,
    hair: Math.min(Math.max(appearance.hair, 0), Math.max(styles.length - 1, 0)),
  };
}

function chooseIndex(optionCount: number, random: () => number): number {
  if (optionCount <= 0) return 0;
  return Math.min(optionCount - 1, Math.max(0, Math.floor(random() * optionCount)));
}

export function randomizeCharacterAppearance(
  gender: string,
  random: () => number = Math.random,
): CharacterAppearance {
  const hairStyles = HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["nonbinary"] ?? [];
  return {
    skin: chooseIndex(SKIN_TONES.length, random),
    hair: chooseIndex(hairStyles.length, random),
    hairColor: chooseIndex(HAIR_COLORS.length, random),
    outfit: chooseIndex(OUTFITS.length, random),
    bottoms: chooseIndex(TROUSERS.length, random),
    shoes: chooseIndex(SHOE_COLORS.length, random),
    headwear: chooseIndex(HEADWEAR.length, random),
  };
}
