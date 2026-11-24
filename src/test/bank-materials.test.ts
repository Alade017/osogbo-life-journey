import { expect, it } from "vitest";
import { bankMaterialStyle, bankTexturePixels, type BankTexture } from "@/game/bank-materials";

it("distinguishes warm Cedar surfaces from cool Meridian while retaining polished hall and matte outside surfaces", () => {
  expect(bankMaterialStyle("cedar-bank", "officeFloor").color).not.toBe(
    bankMaterialStyle("meridian-bank", "officeFloor").color,
  );
  expect(bankMaterialStyle("cedar-bank", "floor").roughness).toBeLessThan(
    bankMaterialStyle("cedar-bank", "paving").roughness,
  );
  expect(bankMaterialStyle("meridian-bank", "glass").roughness).toBeLessThan(0.25);
});
it("creates bounded repeatable opaque maps with visible variation for each material", () => {
  for (const kind of [
    "marble",
    "planks",
    "grain",
    "asphalt",
    "brick",
    "stone",
    "concrete",
  ] as BankTexture[]) {
    const pixels = bankTexturePixels(kind, 32);
    expect(pixels).toHaveLength(32 * 32 * 4);
    expect(pixels).toEqual(bankTexturePixels(kind, 32));
    expect(new Set(pixels.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(2);
    expect(pixels.filter((_, i) => i % 4 === 3).every((v) => v === 255)).toBe(true);
  }
  expect(() => bankTexturePixels("marble", 1024)).toThrow(RangeError);
});
