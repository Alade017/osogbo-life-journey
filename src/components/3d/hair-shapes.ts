/** Hair silhouettes map stable saved style labels to procedural geometry families. */
export type HairShape = "cap" | "afro" | "buzz" | "braids" | "locs" | "knots" | "bun";

/** Returns a renderable silhouette for a saved style, or null for bald. */
export function hairShapeFor(style: string): HairShape | null {
  if (/^bald$/i.test(style)) return null;
  if (/afro|twist.?out/i.test(style)) return "afro";
  if (/braid|cornrow/i.test(style)) return "braids";
  if (/loc/i.test(style)) return "locs";
  if (/bantu|knot/i.test(style)) return "knots";
  if (/bun/i.test(style)) return "bun";
  if (/buzz|fade|wave|taper/i.test(style)) return "buzz";
  return "cap";
}
