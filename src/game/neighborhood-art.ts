/** Reviewed, original SVG artwork used by the Phaser neighborhood renderer.
 * These are presentation assets only: their ground anchors align to the existing
 * projected footprint and never change movement or collision dimensions.
 */
export type NeighborhoodBuildingArtKind = "compound" | "shop" | "kiosk";
export type NeighborhoodPropArtKind = "tree" | "streetlight" | "bench" | "bin" | "sign";

export type NeighborhoodArtAsset = {
  key: string;
  path: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scale: number;
};

export const NEIGHBORHOOD_BUILDING_ART: Readonly<
  Record<NeighborhoodBuildingArtKind, NeighborhoodArtAsset>
> = {
  compound: {
    key: "neighborhood-art-compound",
    path: "/assets/world/neighborhood/compound.svg",
    width: 192,
    height: 200,
    originX: 0.5,
    originY: 0.95,
    scale: 0.45,
  },
  shop: {
    key: "neighborhood-art-shop",
    path: "/assets/world/neighborhood/shop.svg",
    width: 192,
    height: 200,
    originX: 0.5,
    originY: 0.95,
    scale: 0.45,
  },
  kiosk: {
    key: "neighborhood-art-kiosk",
    path: "/assets/world/neighborhood/kiosk.svg",
    width: 192,
    height: 200,
    originX: 0.5,
    originY: 0.95,
    scale: 0.38,
  },
};

export const NEIGHBORHOOD_PROP_ART: Readonly<
  Record<NeighborhoodPropArtKind, NeighborhoodArtAsset>
> = {
  tree: {
    key: "neighborhood-art-tree",
    path: "/assets/world/neighborhood/tree.svg",
    width: 128,
    height: 160,
    originX: 0.5,
    originY: 0.94,
    scale: 0.4,
  },
  streetlight: {
    key: "neighborhood-art-streetlight",
    path: "/assets/world/neighborhood/streetlight.svg",
    width: 72,
    height: 176,
    originX: 0.5,
    originY: 0.94,
    scale: 0.35,
  },
  bench: {
    key: "neighborhood-art-bench",
    path: "/assets/world/neighborhood/bench.svg",
    width: 144,
    height: 80,
    originX: 0.5,
    originY: 0.82,
    scale: 0.36,
  },
  bin: {
    key: "neighborhood-art-bin",
    path: "/assets/world/neighborhood/bin.svg",
    width: 64,
    height: 88,
    originX: 0.5,
    originY: 0.94,
    scale: 0.36,
  },
  sign: {
    key: "neighborhood-art-sign",
    path: "/assets/world/neighborhood/sign.svg",
    width: 96,
    height: 112,
    originX: 0.5,
    originY: 0.94,
    scale: 0.36,
  },
};

export const NEIGHBORHOOD_ART_ASSETS = [
  ...Object.values(NEIGHBORHOOD_BUILDING_ART),
  ...Object.values(NEIGHBORHOOD_PROP_ART),
] as const;

export function neighborhoodPropArtKind(
  kind: string,
): NeighborhoodPropArtKind | null {
  if (kind === "tree" || kind === "streetlight" || kind === "bench" || kind === "bin")
    return kind;
  if (kind === "landmark" || kind === "sign") return "sign";
  return null;
}
