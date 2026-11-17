import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

let shared: { color: DataTexture; roughness: DataTexture } | null = null;

/** Small, shared skin maps. Neutral colour variation preserves every saved skin tone. */
export function characterSkinTextures() {
  if (shared) return shared;
  const size = 128;
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      // Periodic waves have no UV seam or random changes between characters/frames.
      const variation = Math.sin(u * 7 + Math.sin(v * 5)) * Math.cos(v * 11 + Math.sin(u * 3));
      const grain = Math.sin(u * 31 + v * 29) * Math.cos(v * 37 - u * 23);
      const tint = Math.round(250 + variation * 2 + grain);
      const matte = Math.round(232 + variation * 7 + grain * 3);
      const i = (y * size + x) * 4;
      color.set([tint, tint, tint, 255], i);
      roughness.set([matte, matte, matte, 255], i);
    }
  }
  const colorMap = new DataTexture(color, size, size);
  const roughnessMap = new DataTexture(roughness, size, size);
  colorMap.colorSpace = SRGBColorSpace;
  for (const texture of [colorMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  colorMap.name = "shared-character-skin-color";
  roughnessMap.name = "shared-character-skin-roughness";
  // These maps live with the shared geometry cache, not with an individual character.
  shared = { color: colorMap, roughness: roughnessMap };
  return shared;
}
