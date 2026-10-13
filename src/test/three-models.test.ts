// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { Mesh } from "three";
import { ThreeNeighborhoodController, sceneTo3D } from "@/game/three-neighborhood";
import { CITY_CENTRE_AREA, toScene } from "@/game/neighborhood-model";
import {
  cityLocationModelPath,
  CITY_LOCATION_MODEL_PATHS,
  DEVELOPMENT_MODELS,
} from "@/types/models";
import { resolveCharacterAnimation } from "@/hooks/useCharacter";
import { characterAppearance3D } from "@/game/character-3d-appearance";
import type { NeighborhoodBridge } from "@/game/neighborhood-scene";

function bridge(): NeighborhoodBridge {
  return {
    origin: { x: 7, y: 6 },
    spawn: { x: 7, y: 6 },
    area: CITY_CENTRE_AREA,
    onNearby: vi.fn(),
    onCheckpoint: vi.fn(),
    onLocationSelected: vi.fn(),
    onInteract: vi.fn(),
    onPlayerSelected: vi.fn(),
    onPlayerTooFar: vi.fn(),
    saveCheckpoint: vi.fn().mockResolvedValue(true),
    onMovementIntent: vi.fn(),
  };
}
describe("3D loader fixtures and authoritative bridge", () => {
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
  it("selects location models by kind and supports a per-location override", () => {
    expect(cityLocationModelPath({ kind: "home" })).toBe(CITY_LOCATION_MODEL_PATHS.home);
    expect(cityLocationModelPath({ kind: "market" })).toBe(CITY_LOCATION_MODEL_PATHS.market);
    expect(cityLocationModelPath({ kind: "work" })).toBe(CITY_LOCATION_MODEL_PATHS.work);
    expect(cityLocationModelPath({})).toBe(DEVELOPMENT_MODELS.building);
    expect(cityLocationModelPath({ kind: "home", modelPath: "/models/city/custom-home.glb" })).toBe(
      "/models/city/custom-home.glb",
    );
  });
  it("loads actual GLBs with embedded idle/walk and independent cloned objects", async () => {
    const loader = new GLTFLoader();
    for (const path of [
      "characters/development-character.glb",
      "city/development-city.glb",
      "city/development-building.glb",
      "rooms/development-room.glb",
    ]) {
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
  it("keeps movement authoritative and sends bounded intent instead of changing position", () => {
    const callbacks = bridge(),
      controller = new ThreeNeighborhoodController(callbacks);
    controller.ready = true;
    controller.lock(false);
    controller.setTouch("right", true);
    controller.tick();
    expect(callbacks.onMovementIntent).toHaveBeenLastCalledWith({ x: 1, y: 0 });
    expect(controller.point).toEqual(callbacks.spawn);
    controller.setTouch("right", false);
    controller.tick();
    expect(callbacks.onCheckpoint).toHaveBeenCalledWith(callbacks.spawn);
    controller.lock(true);
    controller.setTouch("left", true);
    controller.tick();
    expect(callbacks.onMovementIntent).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
  it("updates positions without publishing React changes every network tick", () => {
    const controller = new ThreeNeighborhoodController(bridge());
    controller.setLocalSessionId("self");
    const player = {
      sessionId: "self",
      characterId: "ade",
      name: "Ade",
      gender: "male",
      appearance: "{}",
      x: 7,
      y: 6,
      facing: "south",
    };
    controller.syncNetworkPlayers([player]);
    const version = controller.version;
    controller.syncNetworkPlayers([{ ...player, x: 7.2 }]);
    expect(controller.version).toBe(version);
    expect(controller.point.x).toBe(7.2);
    controller.syncNetworkPlayers([]);
    expect(controller.players.size).toBe(0);
  });
  it("opens details on selection and activates only after Go", () => {
    const callbacks = bridge(),
      controller = new ThreeNeighborhoodController(callbacks);
    controller.ready = true;
    controller.lock(false);
    controller.selectLocation("home");
    expect(callbacks.onLocationSelected).toHaveBeenCalledWith(CITY_CENTRE_AREA.objects[0]);
    expect(callbacks.onInteract).not.toHaveBeenCalled();
    controller.restore({ x: 7 + (170 - 320) / 160, y: 6 + (210 - 300) / 160 });
    controller.goToLocation("home");
    expect(callbacks.onInteract).toHaveBeenCalledWith(CITY_CENTRE_AREA.objects[0]);
    expect(sceneTo3D(toScene({ x: 7, y: 6 }, { x: 7, y: 6 }))).toEqual([0, 0, 0]);
  });
});
