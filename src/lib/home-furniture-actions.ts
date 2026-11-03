import { ACTION_CATALOG, type LifeActionId } from "@/lib/life-simulation";

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

export function homeFurnitureTaskList(
  itemId: string,
): Array<{ action: LifeActionId; need: string }> {
  const need = homeFurnitureNeed(itemId);
  const action = homeFurnitureAction(itemId);

  if (!need || !action) return [];
  return [{ action, need }];
}

/** Alternatives retain distinct server validated durations and effects. */
export function homeFurnitureActions(itemId: string): LifeActionId[] {
 const primary = homeFurnitureAction(itemId); if (!primary) return [];
 const alternatives: Partial<Record<LifeActionId, LifeActionId[]>> = {
 sleep: ["nap", "read_bed"], cook: ["eat"], shower: ["wash_hands"], toilet: ["clean_toilet"],
 study_computer: ["browse_computer"], tend_plant: ["prune_plant"], relax_sofa: ["stretch_sofa"], watch_tv: ["educational_tv"] };
 return [primary, ...(alternatives[primary] ?? [])];
}
export function homeTaskSeconds(action: LifeActionId): number {
 return action === "sleep" ? 120 : Math.max(3, Math.min(30, Math.ceil(ACTION_CATALOG[action].durationMinutes / 2)));
}
