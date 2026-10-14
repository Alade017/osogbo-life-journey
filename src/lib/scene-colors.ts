export type SceneColorToken =
  | "--brand-porcelain"
  | "--brand-ink"
  | "--brand-cream"
  | "--brand-slate"
  | "--brand-mist"
  | "--color-surface"
  | "--scene-sky"
  | "--scene-hill"
  | "--scene-hill-front"
  | "--scene-building"
  | "--scene-building-edge"
  | "--scene-road"
  | "--scene-marking"
  | "--scene-accent"
  | "--scene-wood"
  | "--scene-wood-line"
  | "--scene-tile"
  | "--scene-tile-line";

/** Read the active palette from the shared stylesheet for canvas renderers. */
export function getSceneColor(token: SceneColorToken): string {
  if (typeof document === "undefined") return "white";
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "white";
}
