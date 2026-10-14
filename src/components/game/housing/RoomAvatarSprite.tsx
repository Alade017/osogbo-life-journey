import { memo, useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import {
  HAIR_COLORS,
  normalizeAvatarAppearance,
  OUTFITS,
  SHOE_COLORS,
  SKIN_TONES,
  TROUSERS,
  type Appearance,
} from "@/game/avatar-appearance";

const EMPTY_APPEARANCE: Appearance = {} as Appearance;
const EDGE = "#14213d";
const EQUIPMENT_ACCENT = "#e8b422";

function fillRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
}

function makeAvatarTexture(appearance: Appearance, gender: string, equipmentKey: string) {
  if (typeof document === "undefined") return null;
  const safe = normalizeAvatarAppearance(appearance, gender);
  const worn = new Set(equipmentKey.split("|").filter(Boolean));
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.lineWidth = 3;
  context.lineJoin = "round";
  context.strokeStyle = EDGE;
  context.fillStyle = "rgba(20, 33, 61, .2)";
  context.beginPath();
  context.ellipse(64, 149, 31, 6, 0, 0, Math.PI * 2);
  context.fill();

  const skin = SKIN_TONES[safe.skin]!;
  const shirt = OUTFITS[safe.outfit]!;
  const trousers = TROUSERS[safe.bottoms]!;
  const shoes = SHOE_COLORS[safe.shoes]!;
  const hair = HAIR_COLORS[safe.hairColor]!;

  // Render the base body first, then equipment overlays in bottom/top/shoes/head/accessory order.
  context.fillStyle = trousers;
  fillRoundRect(context, 43, 102, 19, 35, 7);
  fillRoundRect(context, 66, 102, 19, 35, 7);
  context.fillStyle = shirt;
  fillRoundRect(context, 36, 62, 56, 51, 13);
  context.fillStyle = skin;
  fillRoundRect(context, 57, 52, 14, 16, 5);
  context.beginPath();
  context.arc(64, 42, 22, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = hair;
  if (safe.hair !== 3) {
    context.beginPath();
    context.ellipse(
      64,
      29,
      safe.hair === 1 ? 25 : 22,
      safe.hair === 1 ? 15 : 11,
      0,
      Math.PI,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  }

  context.fillStyle = trousers;
  if (worn.has("bottom")) {
    context.strokeStyle = EQUIPMENT_ACCENT;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(52, 107);
    context.lineTo(52, 133);
    context.moveTo(76, 107);
    context.lineTo(76, 133);
    context.stroke();
  }
  context.fillStyle = shirt;
  if (worn.has("top")) {
    context.fillStyle = EQUIPMENT_ACCENT;
    context.strokeStyle = EDGE;
    context.lineWidth = 2;
    fillRoundRect(context, 39, 71, 12, 31, 4);
    context.fillStyle = EDGE;
    context.beginPath();
    context.arc(45, 79, 1.5, 0, Math.PI * 2);
    context.arc(45, 87, 1.5, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = worn.has("shoes") ? EQUIPMENT_ACCENT : shoes;
  context.strokeStyle = EDGE;
  context.lineWidth = 2;
  fillRoundRect(context, 39, 134, 25, 9, 4);
  fillRoundRect(context, 64, 134, 25, 9, 4);

  if (worn.has("head")) {
    context.fillStyle = EQUIPMENT_ACCENT;
    context.strokeStyle = EDGE;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(64, 25, 27, 8, 0, Math.PI, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  if (worn.has("accessory")) {
    context.fillStyle = EQUIPMENT_ACCENT;
    context.strokeStyle = EDGE;
    context.lineWidth = 2;
    fillRoundRect(context, 91, 72, 13, 36, 5);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

type Props = {
  position: [number, number, number];
  appearance?: Appearance | null;
  gender?: string;
  equipment: readonly { slot: string }[];
};

/** A small raster avatar billboard; outfit changes only recreate this sprite texture. */
export const RoomAvatarSprite = memo(function RoomAvatarSprite({
  position,
  appearance,
  gender = "nonbinary",
  equipment,
}: Props) {
  const equipmentKey = equipment
    .map((item) => item.slot)
    .sort()
    .join("|");
  const texture = useMemo(
    () => makeAvatarTexture(appearance ?? EMPTY_APPEARANCE, gender, equipmentKey),
    [appearance, equipmentKey, gender],
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;
  return (
    <sprite position={position} scale={[1.15, 1.55, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
});
