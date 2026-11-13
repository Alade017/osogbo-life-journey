/** Hair silhouettes the body can wear. Saved hair styles map onto these shared shapes. */
export type HairShape = "cap" | "afro" | "buzz";

/** Returns the silhouette for a saved hair style, or null for a bald style. */
export function hairShapeFor(style: string): HairShape | null {
  if (style === "Bald") return null;
  if (/afro/i.test(style)) return "afro";
  if (/buzz|low fade|wave cut/i.test(style)) return "buzz";
  return "cap";
}
