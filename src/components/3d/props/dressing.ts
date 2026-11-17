import type { NeighborhoodDressingKind } from "../../../game/neighborhood-model";
import { WORLD_SCALE } from "../world-theme";
import {
  dyeVatParts,
  jerrycanStackParts,
  marketUmbrellaParts,
  palmTreeParts,
  waterTankParts,
  type PropPart,
} from "./procedural-props";

const cache = new Map<NeighborhoodDressingKind, PropPart[]>();

/** Built once per kind and shared by every placement of that kind. */
export function dressingPartsFor(kind: NeighborhoodDressingKind): PropPart[] {
  const cached = cache.get(kind);
  if (cached) return cached;
  const parts = buildDressing(kind);
  cache.set(kind, parts);
  return parts;
}

function buildDressing(kind: NeighborhoodDressingKind): PropPart[] {
  switch (kind) {
    case "umbrella":
      return marketUmbrellaParts({ height: 1.9, radius: 0.9 });
    case "jerrycans":
      return jerrycanStackParts({ columns: 3, rows: 2, layers: 2 });
    case "water-tank":
      return waterTankParts({ height: 3.2, tankRadius: 0.6 });
    case "dye-vat":
      return dyeVatParts({ radius: 0.9, height: 0.7 });
    case "palm":
      return palmTreeParts({
        height: WORLD_SCALE.character * 3.4,
        frondLength: WORLD_SCALE.character * 1.5,
      });
  }
}
