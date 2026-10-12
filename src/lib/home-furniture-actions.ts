import type { LifeActionId } from "@/lib/life-simulation";

export const HOME_FURNITURE_ACTIONS = {
  sofa: "relax_sofa",
  bed: "sleep",
  stove: "cook",
  shower: "shower",
  toilet: "toilet",
  computer: "study_computer",
  television: "watch_tv",
  plant: "tend_plant",
} as const satisfies Record<string, LifeActionId>;

export type HomeFurnitureId = keyof typeof HOME_FURNITURE_ACTIONS;

export function homeFurnitureAction(itemId: string): LifeActionId | null {
  return itemId in HOME_FURNITURE_ACTIONS
    ? HOME_FURNITURE_ACTIONS[itemId as HomeFurnitureId]
    : null;
}
