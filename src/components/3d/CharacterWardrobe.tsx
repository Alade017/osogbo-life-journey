import type { WornOutfit } from "@/game/wearable-outfits";
import { useEffect, useMemo } from "react";
import type { SkinnedMesh } from "three";
import { OUTFITS, SHOE_COLORS, TROUSERS, type Appearance } from "@/game/avatar-appearance";
import { createFittedClothing } from "./humanoid-clothing";
/** The outfit shares the body's skeleton, so elbows and knees bend with the cloth. */
export function CharacterWardrobe({
  body,
  appearance,
  outfit,
}: {
  body: SkinnedMesh;
  appearance: Appearance;
  outfit?: WornOutfit | undefined;
}) {
  const top = outfit?.colors[0] ?? OUTFITS[appearance.outfit ?? 0] ?? OUTFITS[0]!;
  const bottom = outfit?.colors[1] ?? TROUSERS[appearance.bottoms ?? 0] ?? TROUSERS[0]!;
  const shoes = outfit?.colors[2] ?? SHOE_COLORS[appearance.shoes ?? 0] ?? SHOE_COLORS[0]!;
  const patterned = outfit?.patterned ?? appearance.outfit === 3;
  const cut = outfit?.topCut ?? "tee";
  const mesh = useMemo(
    () => createFittedClothing(body, [top, bottom, shoes], patterned, cut),
    [body, top, bottom, shoes, patterned, cut],
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
