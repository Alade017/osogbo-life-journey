import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, normalizeAvatarAppearance } from "@/components/game/Avatar";
import {
  AVATAR_ANIMATION_CLIPS,
  AVATAR_DIRECTIONS,
  AVATAR_SPRITE_FRAME_COUNT,
  avatarClipFrameRange,
  facingFromMovement,
} from "@/game/character-animation";
import { createAvatarAtlasMarkup, avatarTextureKey } from "@/game/character-texture";

describe("cached avatar artwork and animation clips", () => {
  it("keeps every saved appearance palette index and falls back on invalid data", () => {
    const fullAppearance = {
      skin: 5,
      hair: 5,
      hairColor: 3,
      outfit: 5,
      bottoms: 5,
      shoes: 3,
      headwear: 3,
    };
    expect(normalizeAvatarAppearance(fullAppearance, "male")).toEqual(fullAppearance);
    expect(normalizeAvatarAppearance({ skin: -1, hair: 88, outfit: 9 }, "female")).toEqual({
      skin: 1,
      hair: 1,
      hairColor: 0,
      outfit: 0,
      bottoms: 0,
      shoes: 0,
      headwear: 0,
    });
    expect(normalizeAvatarAppearance(undefined)).toEqual({
      skin: 1,
      hair: 1,
      hairColor: 0,
      outfit: 0,
      bottoms: 0,
      shoes: 0,
      headwear: 0,
    });
  });

  it.each(AVATAR_ANIMATION_CLIPS.map(({ state }) => state))(
    "renders the %s pose through the existing Avatar API",
    (state) => {
      const { container } = render(
        <Avatar appearance={{}} animationState={state} animationFrame={1} facing="east" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("data-avatar-state", state);
      expect(svg).toHaveAttribute("data-avatar-facing", "east");
      expect(svg).toHaveAttribute("viewBox", "0 0 64 80");
    },
  );

  it("assigns every state and direction a distinct, bounded sprite range", () => {
    const ranges = AVATAR_DIRECTIONS.flatMap((facing) =>
      AVATAR_ANIMATION_CLIPS.map(({ state }) => avatarClipFrameRange(state, facing)),
    );
    expect(ranges[0]?.start).toBe(0);
    expect(ranges.at(-1)?.end).toBe(AVATAR_SPRITE_FRAME_COUNT - 1);
    expect(ranges.every(({ start, end }) => start >= 0 && end < AVATAR_SPRITE_FRAME_COUNT)).toBe(
      true,
    );
    expect(avatarClipFrameRange("walk", "west")).toEqual(avatarClipFrameRange("walk", "east"));
  });

  it("turns toward the dominant movement axis and keeps facing while stopped", () => {
    expect(facingFromMovement(-1, 0, "south")).toBe("west");
    expect(facingFromMovement(1, 0, "south")).toBe("east");
    expect(facingFromMovement(0, -1, "east")).toBe("north");
    expect(facingFromMovement(0, 1, "east")).toBe("south");
    expect(facingFromMovement(0, 0, "north")).toBe("north");
  });

  it("builds one pre-renderable sheet containing every pose without per-frame React updates", () => {
    const markup = createAvatarAtlasMarkup(
      { skin: 4, hair: 2, hairColor: 1, outfit: 2, bottoms: 3, shoes: 1, headwear: 2 },
      "female",
    );
    expect((markup.match(/data-avatar-state=/g) ?? []).length).toBe(AVATAR_SPRITE_FRAME_COUNT);
    for (const { state } of AVATAR_ANIMATION_CLIPS) {
      expect(markup).toContain(`data-avatar-state="${state}"`);
    }
    expect(markup).toContain(`height="${60 * AVATAR_SPRITE_FRAME_COUNT}"`);
  });

  it("reuses the same cache key for a look and isolates changed saved options", () => {
    const look = { skin: 3, hair: 1, outfit: 4 };
    expect(avatarTextureKey(look, "female")).toBe(avatarTextureKey(look, "female"));
    expect(avatarTextureKey(look, "female")).not.toBe(
      avatarTextureKey({ ...look, outfit: 5 }, "female"),
    );
  });
});
