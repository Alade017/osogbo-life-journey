import { describe, expect, it } from "vitest";
import {
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  HEADWEAR,
  OUTFITS,
  SHOE_COLORS,
  SKIN_TONES,
  TROUSERS,
} from "@/components/game/Avatar";
import {
  DEFAULT_CHARACTER_APPEARANCE,
  randomizeCharacterAppearance,
} from "@/lib/character-appearance";

describe("character appearance customization", () => {
  it("resets to the established starter look", () => {
    expect(DEFAULT_CHARACTER_APPEARANCE).toEqual({
      skin: 1,
      hair: 1,
      hairColor: 0,
      outfit: 0,
      bottoms: 0,
      shoes: 0,
      headwear: 0,
    });
  });

  it.each(["female", "male", "nonbinary", "unknown"])(
    "keeps randomized %s appearance indices within available assets",
    (gender) => {
      const appearance = randomizeCharacterAppearance(gender, () => 0.999);
      const styles = HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["nonbinary"] ?? [];

      expect(appearance.skin).toBeLessThan(SKIN_TONES.length);
      expect(appearance.hair).toBeLessThan(styles.length);
      expect(appearance.hairColor).toBeLessThan(HAIR_COLORS.length);
      expect(appearance.outfit).toBeLessThan(OUTFITS.length);
      expect(appearance.bottoms).toBeLessThan(TROUSERS.length);
      expect(appearance.shoes).toBeLessThan(SHOE_COLORS.length);
      expect(appearance.headwear).toBeLessThan(HEADWEAR.length);
    },
  );

  it("produces a repeatable look when given a controlled random source", () => {
    const random = () => 0.5;
    expect(randomizeCharacterAppearance("female", random)).toEqual(
      randomizeCharacterAppearance("female", random),
    );
  });
});
