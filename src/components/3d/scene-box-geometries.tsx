import { createContext, useContext, useMemo, type ReactNode } from "react";
import { BoxGeometry } from "three";
import { useStrictSafeDisposal } from "./strict-safe-disposal";

export type SceneBoxGeometryCache = {
  get(size: readonly [number, number, number]): BoxGeometry;
  dispose(): void;
};

/**
 * Each mounted scene owns its own geometry cache. Materials, transforms, and click
 * handlers remain on individual meshes; only identical box dimensions are reused.
 */
export function createSceneBoxGeometryCache(): SceneBoxGeometryCache {
  const geometries = new Map<string, BoxGeometry>();
  return {
    get(size) {
      const key = JSON.stringify(size);
      let geometry = geometries.get(key);
      if (!geometry) {
        geometry = new BoxGeometry(size[0], size[1], size[2]);
        geometries.set(key, geometry);
      }
      return geometry;
    },
    dispose() {
      for (const geometry of geometries.values()) geometry.dispose();
      geometries.clear();
    },
  };
}

const SceneBoxContext = createContext<SceneBoxGeometryCache | null>(null);

export function SceneBoxGeometryProvider({ children }: { children: ReactNode }) {
  const cache = useMemo(createSceneBoxGeometryCache, []);
  useStrictSafeDisposal(cache);
  return <SceneBoxContext.Provider value={cache}>{children}</SceneBoxContext.Provider>;
}

export function useSceneBoxGeometry(size: readonly [number, number, number]): BoxGeometry {
  const cache = useContext(SceneBoxContext);
  if (!cache) throw new Error("Scene box geometries require a SceneBoxGeometryProvider");
  return cache.get(size);
}
