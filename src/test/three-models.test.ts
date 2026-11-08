// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { DEVELOPMENT_MODELS } from "@/types/models";
import { characterAppearance3D } from "@/game/character-3d-appearance";

describe("3D development fixtures", () => {
  it("maps saved appearance palette indices to the 3D customization API", () => {
    expect(characterAppearance3D({ skin: 4, hair: 2, hairColor: 3, outfit: 5 }, "female")).toEqual({
      skinTone: "#c28a5e",
      hairColor: "#8c8c8c",
      hairStyle: "braids",
      outfitColor: "#2b2f3a",
    });
    expect(characterAppearance3D({ hair: 3 })).toMatchObject({ hairStyle: "bald" });
  });
  it("loads the room GLB with independent cloned objects", async () => {
    const loader = new GLTFLoader();
    const bytes = readFileSync(`public${DEVELOPMENT_MODELS.room}`);
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    expect(gltf.scene.children.length).toBeGreaterThan(0);
    const first = clone(gltf.scene),
      second = clone(gltf.scene);
    first.position.x = 4;
    expect(second.position.x).toBe(0);
    expect(readFileSync("public/models/draco/draco_decoder.wasm").length).toBeGreaterThan(0);
  });
});
