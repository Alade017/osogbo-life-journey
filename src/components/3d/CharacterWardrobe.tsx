import { useEffect, useMemo } from "react";
import type { SkinnedMesh } from "three";
import { OUTFITS, SHOE_COLORS, TROUSERS, type Appearance } from "@/game/avatar-appearance";
import { createFittedClothing } from "./humanoid-clothing";
/** The outfit shares the body's skeleton, so elbows and knees bend with the cloth. */
export function CharacterWardrobe({
  body,
  appearance,
}: {
  body: SkinnedMesh;
  appearance: Appearance;
}) {
  const top = OUTFITS[appearance.outfit ?? 0] ?? OUTFITS[0]!;
  const bottom = TROUSERS[appearance.bottoms ?? 0] ?? TROUSERS[0]!;
  const shoes = SHOE_COLORS[appearance.shoes ?? 0] ?? SHOE_COLORS[0]!;
  const mesh = useMemo(
    () => createFittedClothing(body, [top, bottom, shoes], appearance.outfit === 3),
    [body, top, bottom, shoes, appearance.outfit],
  );
  useEffect(
    () => () => {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        material.dispose();
    },
    [mesh],
  );
  return appearance.clothed === false ? null : <primitive object={mesh} dispose={null} />;
}
