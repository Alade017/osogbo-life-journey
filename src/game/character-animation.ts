import type { AvatarAnimationState, AvatarFacing } from "@/components/game/Avatar";

export const AVATAR_DIRECTIONS = ["south", "east", "north"] as const satisfies readonly AvatarFacing[];
export const AVATAR_ANIMATION_CLIPS = [
  { state: "idle", frames: 2, frameRate: 2, repeat: -1 },
  { state: "walk", frames: 4, frameRate: 9, repeat: -1 },
  { state: "turn", frames: 4, frameRate: 12, repeat: 0 },
  { state: "talk", frames: 2, frameRate: 3, repeat: -1 },
  { state: "work", frames: 4, frameRate: 6, repeat: -1 },
] as const satisfies readonly {
  state: AvatarAnimationState;
  frames: number;
  frameRate: number;
  repeat: number;
}[];

export const AVATAR_FRAMES_PER_DIRECTION = AVATAR_ANIMATION_CLIPS.reduce(
  (count, clip) => count + clip.frames,
  0,
);
export const AVATAR_SPRITE_FRAME_COUNT = AVATAR_FRAMES_PER_DIRECTION * AVATAR_DIRECTIONS.length;

export function avatarAnimationKey(
  textureKey: string,
  state: AvatarAnimationState,
  facing: AvatarFacing,
) {
  return `${textureKey}:${state}:${facing}`;
}

export function avatarClipFrameRange(state: AvatarAnimationState, facing: AvatarFacing) {
  const directionIndex = facing === "west" ? AVATAR_DIRECTIONS.indexOf("east") : AVATAR_DIRECTIONS.indexOf(facing as (typeof AVATAR_DIRECTIONS)[number]);
  const directionOffset = (directionIndex < 0 ? 0 : directionIndex) * AVATAR_FRAMES_PER_DIRECTION;
  let clipOffset = 0;
  for (const clip of AVATAR_ANIMATION_CLIPS) {
    if (clip.state === state) {
      return {
        start: directionOffset + clipOffset,
        end: directionOffset + clipOffset + clip.frames - 1,
        frameRate: clip.frameRate,
        repeat: clip.repeat,
      };
    }
    clipOffset += clip.frames;
  }
  return { start: directionOffset, end: directionOffset + 1, frameRate: 2, repeat: -1 };
}

export function facingFromMovement(x: number, y: number, current: AvatarFacing): AvatarFacing {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (!x && !y)) return current;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? "west" : "east";
  return y < 0 ? "north" : "south";
}

export function parseSavedAppearance(value: string | unknown) {
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}
