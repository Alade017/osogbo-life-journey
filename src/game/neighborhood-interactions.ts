import type { WorldMapCategory } from "../lib/city-world";
import type { NeighborhoodNpcView, NeighborhoodObject } from "./neighborhood-model";

export type NeighborhoodInteractionAvailability = {
  hasPersonalHome: boolean;
  hasHomeType: boolean;
  hasShopOffers: boolean;
  hasLocalBusinesses: boolean;
  hasBankServices: boolean;
  venueEntranceKind: "market" | "work" | null;
  hasCareerServices: boolean;
};

/** Keep category-to-entrance semantics exhaustive as world categories evolve. */
const VENUE_ENTRANCE_BY_CATEGORY: Record<WorldMapCategory, "market" | "work" | null> = {
  residential: null,
  commercial: "market",
  work_industrial: "work",
  education: "work",
  health: "work",
  transport: "work",
  government: "work",
  recreation: "work",
  water_nature: "work",
};

export function venueEntranceKindForCategory(
  category: string | null | undefined,
): "market" | "work" | null {
  if (!category || !Object.hasOwn(VENUE_ENTRANCE_BY_CATEGORY, category)) return null;
  return VENUE_ENTRANCE_BY_CATEGORY[category as WorldMapCategory];
}

/** Keep actionable entrances aligned with services available at the confirmed location. */
export function availableNeighborhoodTargets(
  objects: readonly NeighborhoodObject[],
  availability: NeighborhoodInteractionAvailability,
): NeighborhoodObject[] {
  return objects.filter((object) => {
    if (object.kind === "npc") return true;
    if (object.kind === "home")
      return availability.hasPersonalHome && availability.hasHomeType;
    if (object.kind === "market")
      return (
        availability.hasShopOffers ||
        availability.hasLocalBusinesses ||
        availability.hasBankServices ||
        availability.venueEntranceKind === "market"
      );
    if (object.kind === "work")
      return availability.hasCareerServices || availability.venueEntranceKind === "work";
    return false;
  });
}


/** Navigate toward an NPC's current scheduled destination while they are walking. */
export function neighborhoodNpcNavigationPoint(
  target: NeighborhoodObject,
  npcs: readonly Pick<NeighborhoodNpcView, "id" | "x" | "y" | "targetX" | "targetY" | "isMoving">[],
): { x: number; y: number } {
  if (target.kind !== "npc") return { x: target.x, y: target.y };
  const npc = npcs.find((candidate) => candidate.id === target.id);
  if (!npc) return { x: target.x, y: target.y };
  return npc.isMoving ? { x: npc.targetX, y: npc.targetY } : { x: npc.x, y: npc.y };
}

/** Interaction range must be measured from the NPC's actual position, never its future destination. */
export function neighborhoodInteractionPoint(
  target: NeighborhoodObject,
  npcs: readonly Pick<NeighborhoodNpcView, "id" | "x" | "y">[],
): { x: number; y: number } {
  if (target.kind !== "npc") return { x: target.x, y: target.y };
  const npc = npcs.find((candidate) => candidate.id === target.id);
  return npc ? { x: npc.x, y: npc.y } : { x: target.x, y: target.y };
}
