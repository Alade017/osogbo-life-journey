import { BANK_BRANCH_DESIGNS, type BankSurface } from "./bank-world-layout";
import type { BankSlug } from "@/lib/bank-branch-data";
export type BankTexture =
  "marble" | "planks" | "grain" | "asphalt" | "brick" | "stone" | "concrete";
export interface BankMaterialStyle {
  color: string;
  roughness: number;
  metalness: number;
  texture?: BankTexture;
}
/** Small, deterministic texture maps; no model, image or font downloads. */
export function bankMaterialStyle(branch: BankSlug, surface: BankSurface): BankMaterialStyle {
  const d = BANK_BRANCH_DESIGNS[branch],
    warm = branch === "cedar-bank";
  const colors: Record<BankSurface, string> = {
    wall: d.wall,
    brand: d.brand,
    wood: d.wood,
    floor: warm ? "#eee6d8" : "#e4ebef",
    paving: "#50575b",
    metal: "#a3adb5",
    dark: "#283039",
    glass: "#c2d9e2",
    screen: "#7db7b1",
    led: "#f4f8ff",
    marking: "#f3f1e8",
    foliage: "#527151",
    stone: warm ? "#b8ad99" : "#b3bec8",
    brick: "#b99883",
    officeFloor: warm ? "#82715f" : "#5e6a76",
    leather: warm ? "#46413c" : "#364e6c",
    soil: "#4a4034",
    cladding: warm ? "#cdc4b5" : "#c6d0d8",
    roof: warm ? "#dad7cf" : "#b4c2ce",
  };
  const texture: Partial<Record<BankSurface, BankTexture>> = {
    wall: "concrete",
    wood: "grain",
    floor: "marble",
    paving: "asphalt",
    stone: "stone",
    brick: "brick",
    officeFloor: "planks",
    cladding: "stone",
    roof: "concrete",
  };
  const detail = texture[surface];
  return {
    color: colors[surface],
    roughness:
      surface === "floor"
        ? 0.2
        : surface === "officeFloor"
          ? 0.48
          : surface === "metal"
            ? 0.28
            : surface === "glass"
              ? 0.16
              : 0.85,
    metalness: surface === "metal" ? 0.7 : 0,
    ...(detail ? { texture: detail } : {}),
  };
}
const noise = (x: number, y: number) => {
  let n = Math.imul(x + 137, 374761393) ^ Math.imul(y + 71, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
/** Neutral albedo detail multiplied by the branch material color. Tile/board seams remain repeatable. */
export function bankTexturePixels(kind: BankTexture, size = 256): Uint8Array {
  if (!Number.isInteger(size) || size < 8 || size > 512)
    throw new RangeError("Bank textures must be between 8 and 512 pixels.");
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        n = noise(x, y);
      let tone = 240;
      if (kind === "marble") {
        const vein = Math.sin(u * 32 + Math.sin(v * 16) * 1.8 + Math.sin((u + v) * 11));
        tone = 245 - (Math.abs(vein) > 0.97 ? 16 : 0) + (n - 0.5) * 5;
        if ((u * 15) % 1 < 0.025 || (v * 13.5) % 1 < 0.025) tone = 193;
      } else if (kind === "planks") {
        const column = Math.floor(u * 72),
          row = Math.floor(v * 11 + (column % 2) * 0.5);
        tone =
          207 + noise(column, row) * 30 + Math.sin(v * 850 + Math.sin(u * 60)) * 6 + (n - 0.5) * 8;
        if ((u * 72) % 1 < 0.1 || (v * 11 + (column % 2) * 0.5) % 1 < 0.035) tone = 153;
      } else if (kind === "grain")
        tone = 227 + Math.sin(u * 70 + Math.sin(v * 9) * 1.6) * 13 + (n - 0.5) * 8;
      else if (kind === "brick") {
        const row = Math.floor(v * 70),
          col = Math.floor(u * 100 + (row % 2) * 0.5);
        tone = 214 + noise(col, row) * 30 + (n - 0.5) * 6;
        if ((u * 100 + (row % 2) * 0.5) % 1 < 0.12 || (v * 70) % 1 < 0.13) tone = 164;
      } else if (kind === "stone") {
        tone = 232 + Math.sin(u * 13 + v * 6) * 6 + (n - 0.5) * 8;
        if ((u * 12) % 1 < 0.015 || (v * 12) % 1 < 0.015) tone = 179;
      } else if (kind === "asphalt") tone = 213 + (n - 0.5) * 31;
      else tone = 239 + Math.sin(u * 10 + v * 13) * 4 + (n - 0.5) * 9;
      const i = (y * size + x) * 4,
        t = Math.max(0, Math.min(255, Math.round(tone)));
      pixels[i] = t;
      pixels[i + 1] = t;
      pixels[i + 2] = t;
      pixels[i + 3] = 255;
    }
  return pixels;
}
