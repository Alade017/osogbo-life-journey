import { getLandmarkBuildingVariant } from "./landmark-building-variant";

/** Presentation only: never alter footprint, travel coordinates or server state. */
export function townBuildingProfile(type: string, x: number, z: number, cell: number) {
  const variant = getLandmarkBuildingVariant(type);
  const floors =
    variant === "bank"
      ? 3
      : ["civic", "health", "school", "services"].includes(variant)
        ? 2
        : variant === "residential"
          ? 1 + (Math.abs(x * 17 + z * 31) % 2)
          : 1;
  const floorHeight = cell * 0.66;
  return {
    variant,
    floors,
    floorHeight,
    height: floors * floorHeight,
    width: cell * 1.15,
    depth: cell * 1.15,
  };
}
