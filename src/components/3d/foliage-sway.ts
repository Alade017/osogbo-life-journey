import type { MeshStandardMaterial } from "three";

/** Shared uniforms so every foliage material sways from one clock. */
export const FOLIAGE_SWAY = {
  time: { value: 0 },
  amplitude: { value: 0.035 },
};

export function foliageSwayAmplitude({ reducedMotion }: { reducedMotion: boolean }): number {
  return reducedMotion ? 0 : 0.035;
}

/**
 * Adds a gentle wind wobble to a material's vertices. Only the upper part of a mesh moves
 * (height is measured from the mesh's centre), and instanced meshes keep a phase per instance.
 */
export function applyFoliageSway(material: MeshStandardMaterial): void {
  if (material.userData["foliageSway"]) return;
  material.userData["foliageSway"] = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms["uSwayTime"] = FOLIAGE_SWAY.time;
    shader.uniforms["uSwayAmp"] = FOLIAGE_SWAY.amplitude;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uSwayTime;\nuniform float uSwayAmp;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec3 swayOrigin = instanceMatrix[3].xyz;
  #else
  vec3 swayOrigin = vec3(0.0);
  #endif
  float swayHeight = max(position.y + 0.5, 0.0);
  float swayWave = sin(uSwayTime * 1.7 + swayOrigin.x * 0.9 + swayOrigin.z * 0.6);
  transformed.x += swayWave * uSwayAmp * swayHeight;
  transformed.z += cos(uSwayTime * 1.3 + swayOrigin.z * 0.8) * uSwayAmp * swayHeight * 0.6;`,
      );
  };
  material.customProgramCacheKey = () => "foliage-sway";
  material.needsUpdate = true;
}
