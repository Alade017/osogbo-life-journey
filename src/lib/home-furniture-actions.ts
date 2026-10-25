import type { LifeActionId } from "@/lib/life-simulation";

export const HOME_FURNITURE_ACTIONS = {
  "starter-bed": "sleep",
  "starter-seat": "relax_sofa",
  sofa: "relax_sofa",
  bed: "sleep",
  stove: "cook",
  shower: "shower",
  toilet: "toilet",
  computer: "study_computer",
  television: "watch_tv",
  plant: "tend_plant",
  "quilted-bed": "sleep",
  "lounge-sofa": "relax_sofa",
  "two-burner-cooker": "cook",
  "rain-shower": "shower",
  "study-computer": "study_computer",
  "potted-fern": "tend_plant",
} as const satisfies Record<string, LifeActionId>;

export type HomeFurnitureId = keyof typeof HOME_FURNITURE_ACTIONS;

export function homeFurnitureAction(itemId: string): LifeActionId | null {
  return itemId in HOME_FURNITURE_ACTIONS
    ? HOME_FURNITURE_ACTIONS[itemId as HomeFurnitureId]
    : null;
}

export const HOME_FURNITURE_NEEDS: Partial<Record<HomeFurnitureId, string>> = {
  "starter-bed": "Energy",
  bed: "Energy",
  "starter-seat": "Fun",
  sofa: "Fun",
  stove: "Hunger",
  shower: "Hygiene",
  toilet: "Bladder",
  television: "Fun",
  plant: "Fun",
  "quilted-bed": "Energy",
  "lounge-sofa": "Fun",
  "two-burner-cooker": "Hunger",
  "rain-shower": "Hygiene",
  "potted-fern": "Fun",
};

export function homeFurnitureNeed(itemId: string): string | null {
  return itemId in HOME_FURNITURE_NEEDS
    ? (HOME_FURNITURE_NEEDS[itemId as HomeFurnitureId] ?? null)
    : null;
}
