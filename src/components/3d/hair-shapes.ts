/** Hair silhouettes the body can wear. Saved hair styles map onto these, so no style is hardcoded per body. */
export type HairShape = "cap" | "afro" | "buzz";

/** Returns the silhouette for a hair style name, or null for a bald style. */
export function hairShapeFor(style: string): HairShape | null {
  if (style === "Bald") return null;
  if (/afro/i.test(style)) return "afro";
  if (/(?:fade|wave cut)/i.test(style)) return "buzz";
  return "cap";
}
