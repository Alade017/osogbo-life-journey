import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Phaser from "phaser";
import {
  AvatarArtwork,
  normalizeAvatarAppearance,
  type Appearance,
  type AvatarAnimationState,
  type AvatarEquipment,
  type AvatarFacing,
} from "@/components/game/Avatar";
import {
  AVATAR_ANIMATION_CLIPS,
  AVATAR_DIRECTIONS,
  AVATAR_SPRITE_FRAME_COUNT,
  avatarAnimationKey,
} from "./character-animation";

export const AVATAR_FRAME_WIDTH = 48;
export const AVATAR_FRAME_HEIGHT = 60;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function avatarTextureKey(
  appearance: Appearance | null | undefined,
  gender = "nonbinary",
  equipment: readonly AvatarEquipment[] = [],
) {
  const normalized = normalizeAvatarAppearance(appearance, gender);
  const slots = equipment.map(({ slot }) => slot).sort();
  return `osogbo-avatar-${stableHash(JSON.stringify([gender, normalized, slots]))}`;
}

/** Build a single, static SVG atlas. Phaser advances frames; SVG never runs per game frame. */
export function createAvatarAtlasMarkup(
  appearance: Appearance | null | undefined,
  gender = "nonbinary",
  equipment: readonly AvatarEquipment[] = [],
) {
  const frames = AVATAR_DIRECTIONS.flatMap((facing) =>
    AVATAR_ANIMATION_CLIPS.flatMap((clip) =>
      Array.from({ length: clip.frames }, (_, frame) => ({ facing, state: clip.state, frame })),
    ),
  );
  const svgFrames = frames.map(({ facing, state, frame }, index) =>
    createElement(AvatarArtwork, {
      key: index,
      appearance: appearance ?? {},
      gender,
      equipment,
      animationState: state as AvatarAnimationState,
      animationFrame: frame,
      facing: facing as AvatarFacing,
      width: AVATAR_FRAME_WIDTH,
      height: AVATAR_FRAME_HEIGHT,
      x: 0,
      y: index * AVATAR_FRAME_HEIGHT,
    }),
  );
  return renderToStaticMarkup(
    createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: AVATAR_FRAME_WIDTH,
        height: AVATAR_FRAME_HEIGHT * AVATAR_SPRITE_FRAME_COUNT,
        viewBox: `0 0 ${AVATAR_FRAME_WIDTH} ${AVATAR_FRAME_HEIGHT * AVATAR_SPRITE_FRAME_COUNT}`,
      },
      svgFrames,
    ),
  );
}

const pendingAtlases = new WeakMap<Phaser.Textures.TextureManager, Map<string, Promise<string | null>>>();

function registerAnimations(scene: Phaser.Scene, textureKey: string) {
  let start = 0;
  for (const facing of AVATAR_DIRECTIONS) {
    for (const clip of AVATAR_ANIMATION_CLIPS) {
      const key = avatarAnimationKey(textureKey, clip.state, facing);
      if (!scene.anims.exists(key)) {
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(textureKey, {
            start,
            end: start + clip.frames - 1,
          }),
          frameRate: clip.frameRate,
          repeat: clip.repeat,
        });
      }
      start += clip.frames;
    }
  }
}

export function ensureAvatarTexture(
  scene: Phaser.Scene,
  appearance: Appearance | null | undefined,
  gender = "nonbinary",
  equipment: readonly AvatarEquipment[] = [],
): Promise<string | null> {
  const textureKey = avatarTextureKey(appearance, gender, equipment);
  if (scene.textures.exists(textureKey)) {
    registerAnimations(scene, textureKey);
    return Promise.resolve(textureKey);
  }

  let sceneCache = pendingAtlases.get(scene.textures);
  if (!sceneCache) {
    sceneCache = new Map();
    pendingAtlases.set(scene.textures, sceneCache);
  }
  const pending = sceneCache.get(textureKey);
  if (pending) return pending;

  const promise = new Promise<string | null>((resolve) => {
    const image = new Image();
    const markup = createAvatarAtlasMarkup(appearance, gender, equipment);
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    const timeout = window.setTimeout(() => finish(null), 12_000);
    let settled = false;
    const finish = (key: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(key);
    };
    image.onload = () => {
      try {
        if (!scene.sys.isActive()) return finish(null);
        scene.textures.addSpriteSheet(textureKey, image, {
          frameWidth: AVATAR_FRAME_WIDTH,
          frameHeight: AVATAR_FRAME_HEIGHT,
          endFrame: AVATAR_SPRITE_FRAME_COUNT - 1,
        });
        registerAnimations(scene, textureKey);
        finish(textureKey);
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = url;
  }).finally(() => sceneCache!.delete(textureKey));

  sceneCache.set(textureKey, promise);
  return promise;
}
