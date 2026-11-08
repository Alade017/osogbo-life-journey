import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { CHARACTER_CLOTH } from "./character-config";

let adire: Texture | null = null;

/**
 * Indigo resist-dye motif for patterned outfits. Built once on the client from the tuning in
 * character-config; returns null where no canvas is available.
 */
export function adireTexture(): Texture | null {
  if (adire) return adire;
  if (typeof document === "undefined") return null;
  const { textureSize: size, adire: palette } = CHARACTER_CLOTH;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const cell = size / palette.cells;
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = palette.motif;
  ctx.strokeStyle = palette.motif;
  ctx.lineWidth = cell * 0.07;
  for (let row = 0; row < palette.cells; row++) {
    for (let col = 0; col < palette.cells; col++) {
      const x = col * cell + cell / 2;
      const y = row * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - cell * 0.35, y - cell * 0.35);
      ctx.lineTo(x + cell * 0.35, y + cell * 0.35);
      ctx.stroke();
    }
  }
  adire = new CanvasTexture(canvas);
  adire.wrapS = RepeatWrapping;
  adire.wrapT = RepeatWrapping;
  adire.colorSpace = SRGBColorSpace;
  return adire;
}
