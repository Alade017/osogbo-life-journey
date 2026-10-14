// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { Mesh } from "three";
import { DEVELOPMENT_MODELS } from "@/types/models";
import { resolveCharacterAnimation } from "@/hooks/useCharacter";
import { characterAppearance3D } from "@/game/character-3d-appearance";

describe("3D character and interior fixtures", () => {
  it("resolves semantic animation states and falls back to idle for older models", () => {
    const clips = ["Idle", "Walk", "Wave"];
    expect(resolveCharacterAnimation("wave", clips)).toBe("Wave");
    expect(resolveCharacterAnimation("sit", clips)).toBe("Idle");
    expect(resolveCharacterAnimation("walk", clips, { walk: "Walk" })).toBe("Walk");
    expect(resolveCharacterAnimation("Unknown", clips)).toBe("Idle");
  });
  it("maps saved appearance palette indices to the 3D customization API", () => {
    expect(characterAppearance3D({ skin: 4, hair: 2, hairColor: 3, outfit: 5 }, "female")).toEqual({
      skinTone: "#c28a5e",
      hairColor: "#8c8c8c",
      hairStyle: "braids",
      outfitColor: "#2b2f3a",
    });
    expect(characterAppearance3D({ hair: 3 })).toMatchObject({ hairStyle: "bald" });
  });
  it("loads character and room GLBs with independent cloned objects", async () => {
    const loader = new GLTFLoader();
    for (const path of ["characters/development-character.glb", "rooms/development-room.glb"]) {
      const bytes = readFileSync(`public/models/${path}`);
      const gltf = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        "",
      );
      expect(gltf.scene.children.length).toBeGreaterThan(0);
      const first = clone(gltf.scene),
        second = clone(gltf.scene);
      first.position.x = 4;
      expect(second.position.x).toBe(0);
      if (path.startsWith("characters")) {
        expect(gltf.animations.map((clip) => clip.name)).toEqual([
          "Idle",
          "Walk",
          "Sit",
          "Work",
          "Wave",
        ]);
        const materialNames = new Set<string>();
        gltf.scene.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => materialNames.add(material.name));
        });
        expect(materialNames).toContain("Skin");
        expect(materialNames).toContain("Outfit");
        expect(gltf.scene.getObjectByName("Head")).toBeDefined();
        expect(
          gltf.animations
            .find((clip) => clip.name === "Wave")
            ?.tracks.some((track) => track.name.includes("RightArm")),
        ).toBe(true);
      }
    }
    expect(readFileSync("public/models/draco/draco_decoder.wasm").length).toBeGreaterThan(0);
  });
});
