import { isValidElement, type ReactNode } from "react";
import * as Phaser from "phaser";
import {
  AvatarArtwork,
  normalizeAvatarAppearance,
  type Appearance,
  type AvatarAnimationState,
  type AvatarEquipment,
  type AvatarFacing,
} from "../components/game/Avatar";
import {
  AVATAR_ANIMATION_CLIPS,
  AVATAR_DIRECTIONS,
  AVATAR_SPRITE_FRAME_COUNT,
  avatarAnimationKey,
} from "./character-animation";

export const AVATAR_FRAME_WIDTH = 48;
export const AVATAR_FRAME_HEIGHT = 60;

const SVG_ATTRIBUTE_NAMES: Record<string, string> = {
  className: "class",
  pointerEvents: "pointer-events",
  shapeRendering: "shape-rendering",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeWidth: "stroke-width",
};

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** Serialize the small, static AvatarArtwork SVG tree without bundling react-dom/server. */
function serializeSvg(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(serializeSvg).join("");
  if (!isValidElement<Record<string, unknown>>(node) || typeof node.type !== "string") return "";

  const props = node.props;
  const attributes = Object.entries(props)
    .filter(
      ([key, value]) =>
        key !== "children" &&
        key !== "key" &&
        key !== "ref" &&
        key !== "dangerouslySetInnerHTML" &&
        value !== undefined &&
        value !== null &&
        typeof value !== "boolean",
    )
    .map(
      ([key, value]) => ` ${SVG_ATTRIBUTE_NAMES[key] ?? key}="${escapeAttribute(String(value))}"`,
    )
    .join("");
  const inner = (props["dangerouslySetInnerHTML"] as { __html?: string } | undefined)?.__html;
  return `<${node.type}${attributes}>${inner ?? serializeSvg(props["children"] as ReactNode)}</${node.type}>`;
}

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
  const svgFrames = frames
    .map(({ facing, state, frame }, index) =>
      serializeSvg(
        AvatarArtwork({
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
      ),
    )
    .join("");
  const atlasHeight = AVATAR_FRAME_HEIGHT * AVATAR_SPRITE_FRAME_COUNT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR_FRAME_WIDTH}" height="${atlasHeight}" viewBox="0 0 ${AVATAR_FRAME_WIDTH} ${atlasHeight}">${svgFrames}</svg>`;
}

const pendingAtlases = new WeakMap<
  Phaser.Textures.TextureManager,
  Map<string, Promise<string | null>>
>();

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
