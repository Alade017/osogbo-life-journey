/** Artwork is opt-in so a missing asset never produces a broken image. */
export const ITEM_ART: Readonly<Record<string, string>> = {
  computer: "/assets/items/computer.webp",
  shower: "/assets/items/shower.webp",
  starter_bed: "/assets/items/starter-bed.webp",
  starter_light: "/assets/items/starter-light.webp",
  starter_seat: "/assets/items/starter-seat.webp",
  stove: "/assets/items/stove.webp",
  television: "/assets/items/television.webp",
  toilet: "/assets/items/toilet.webp",
};

export function getItemArt(slug: string | null | undefined) {
  return slug ? (ITEM_ART[slug] ?? null) : null;
}
