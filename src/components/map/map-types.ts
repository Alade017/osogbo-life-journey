/** Shared place and district shapes for the town map and the place action flow. */
export type LandmarkCategory =
  | "market"
  | "transport"
  | "school"
  | "health"
  | "worship"
  | "junction"
  | "sport"
  | "food"
  | "services";

export type DistrictTheme =
  "market" | "residential" | "leisure" | "transport" | "school" | "outskirts";
export type Traffic = "low" | "medium" | "high";

export type MapLandmark = {
  id: string;
  label: string;
  category: LandmarkCategory;
  x: number;
  y: number;
  verify: boolean;
  source?: string;
  isoCell?: { col: number; row: number };
  buildingId?: string;
  actions?: MapPlaceAction[];
};

export type MapBuilding = {
  id: string;
  landmark_id: string;
  name: string;
  short_name?: string;
  category: LandmarkCategory;
  position: { col: number; row: number };
  footprint: { width: number; depth: number };
  facade_slot?: string;
  verify: boolean;
};

export type MapTownProp = {
  id: string;
  kind: "home" | "shop" | "tree";
  position: { col: number; row: number };
  footprint: { width: number; depth: number };
  interactive: false;
  verify: boolean;
};

export type MapPlaceAction = {
  id: string;
  label: string;
  description: string;
  time_cost_minutes: number;
  money_minor: { min: number; max: number };
  mood_effect: number;
  requirement: string;
  open_hours: { start: number; end: number };
  cooldown_game_minutes?: number;
  needs_effects?: { hunger_satisfaction?: number };
  verify: boolean;
};

export type MapDistrict = {
  id: string;
  name: string;
  verify?: boolean;
  theme: DistrictTheme;
  traffic: Traffic;
  description: string;
  shape: [number, number][];
  source?: string;
  isoCells?: { col: number; row: number }[];
  height?: number;
  landmarks: MapLandmark[];
  buildings?: MapBuilding[];
  props?: MapTownProp[];
};
