import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  BusFront,
  Church,
  Fuel,
  GraduationCap,
  Hospital,
  House,
  Landmark,
  MapPin,
  Music2,
  School,
  Shield,
  ShoppingBag,
  Store,
  TreePine,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import type { MapLocation } from "@/lib/game";

export const LOCATION_CATEGORIES = {
  home: { label: "Homes", singular: "Home", icon: House, colour: "#0b5ed7" },
  government: { label: "Government", singular: "Government", icon: Landmark, colour: "#344b68" },
  market: { label: "Markets", singular: "Market", icon: Store, colour: "#bf741b" },
  shop: { label: "Shops", singular: "Shop", icon: ShoppingBag, colour: "#9a6b42" },
  restaurant: { label: "Restaurants", singular: "Restaurant", icon: Utensils, colour: "#a65343" },
  bank: { label: "Banks", singular: "Bank", icon: Banknote, colour: "#159a6c" },
  hospital: { label: "Hospitals", singular: "Hospital", icon: Hospital, colour: "#dc2626" },
  police: { label: "Police stations", singular: "Police station", icon: Shield, colour: "#083b82" },
  school: { label: "Schools", singular: "School", icon: School, colour: "#596f9a" },
  university: {
    label: "Universities",
    singular: "University",
    icon: GraduationCap,
    colour: "#536eae",
  },
  entertainment: {
    label: "Entertainment",
    singular: "Entertainment",
    icon: Music2,
    colour: "#87529d",
  },
  transport: { label: "Transport", singular: "Transport", icon: BusFront, colour: "#4d7c8c" },
  residential: { label: "Residential", singular: "Residential", icon: House, colour: "#66815d" },
  workplace: {
    label: "Workplaces",
    singular: "Workplace",
    icon: BriefcaseBusiness,
    colour: "#52657b",
  },
  landmark: { label: "Landmarks", singular: "Landmark", icon: Landmark, colour: "#9a8146" },
  custom: { label: "Other locations", singular: "Other", icon: MapPin, colour: "#667085" },
  fuel_station: { label: "Fuel stations", singular: "Fuel station", icon: Fuel, colour: "#f59e0b" },
  business: {
    label: "Businesses",
    singular: "Business",
    icon: BriefcaseBusiness,
    colour: "#083b82",
  },
  park: { label: "Parks", singular: "Park", icon: TreePine, colour: "#159a6c" },
  cultural_landmark: {
    label: "Cultural landmarks",
    singular: "Cultural landmark",
    icon: Landmark,
    colour: "#0b5ed7",
  },
  religious: {
    label: "Religious sites",
    singular: "Religious site",
    icon: Church,
    colour: "#8b5b74",
  },
  transportation: {
    label: "Transport points",
    singular: "Transport point",
    icon: BusFront,
    colour: "#f59e0b",
  },
  other: { label: "Other locations", singular: "Other", icon: MapPin, colour: "#667085" },
} as const satisfies Record<
  string,
  { label: string; singular: string; icon: LucideIcon; colour: string }
>;

export type LocationCategory = keyof typeof LOCATION_CATEGORIES;
export type LocationActionStatus = "available" | "coming_soon";
export type LocationActionDefinition = {
  id: string;
  label: string;
  status: LocationActionStatus;
};
export type CityLocationData = MapLocation & {
  category: LocationCategory;
  availableActions: LocationActionDefinition[];
  openingHours: string | null;
  neighborhood: string | null;
  neighborhoodId: string | null;
  entryCost: { amount: number; currency: "NGN" } | null;
  interactionType: string | null;
  accessibility: string[];
  unlockRequirements: Json | null;
  status: "active" | "inactive";
};

const LEGACY_TYPE_CATEGORY: Record<string, LocationCategory> = {
  residential: "residential",
  bank: "bank",
  hospital: "hospital",
  police: "police",
  market: "market",
  restaurant: "restaurant",
  school: "school",
  university: "university",
  workplace: "workplace",
  shop: "shop",
  government: "government",
  entertainment: "entertainment",
  transport: "transport",
  landmark: "landmark",
  custom: "custom",
};

export const LOCATION_MARKER_GLYPHS: Partial<Record<LocationCategory, string>> = {
  government: "G",
  market: "M",
  shop: "S",
  restaurant: "R",
  bank: "B",
  hospital: "+",
  police: "P",
  school: "S",
  university: "U",
  entertainment: "E",
  transport: "T",
  residential: "H",
  workplace: "W",
  landmark: "L",
};

export const LOCATION_ICONS: Record<string, LucideIcon> = {
  bank: Banknote,
  banknote: Banknote,
  business: BriefcaseBusiness,
  "building-2": Building2,
  "bus-front": BusFront,
  fuel: Fuel,
  "fuel-station": Fuel,
  government: Landmark,
  home: House,
  hospital: Hospital,
  landmark: Landmark,
  "map-pin": MapPin,
  market: Store,
  restaurant: Utensils,
  school: School,
  university: GraduationCap,
  police: Shield,
  entertainment: Music2,
  park: TreePine,
  transport: BusFront,
  transportation: BusFront,
  residential: House,
  workplace: Building2,
  shop: ShoppingBag,
  "cultural-landmark": Landmark,
  custom: MapPin,
};

type MetadataOwner = {
  type: string;
  metadata: Json;
};

function metadataRecord(value: Json): { [key: string]: Json | undefined } | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isLocationCategory(value: string): value is LocationCategory {
  return Object.hasOwn(LOCATION_CATEGORIES, value);
}

export function getLocationCategory(location: MetadataOwner): LocationCategory {
  const metadata = metadataRecord(location.metadata);
  const override = metadata?.["category"];
  if (typeof override === "string" && isLocationCategory(override)) return override;
  return LEGACY_TYPE_CATEGORY[location.type] ?? "other";
}

export function locationCategoryColour(category: string) {
  return LOCATION_CATEGORIES[isLocationCategory(category) ? category : "other"].colour;
}

export function locationCategoryIcon(category: string) {
  return LOCATION_CATEGORIES[isLocationCategory(category) ? category : "other"].icon;
}

export function getLocationActions(metadataValue: Json): LocationActionDefinition[] {
  const rawActions = metadataRecord(metadataValue)?.["available_actions"];
  if (!Array.isArray(rawActions)) return [];

  return rawActions.flatMap((rawAction) => {
    if (typeof rawAction === "string" && rawAction.trim()) {
      return [{ id: rawAction, label: rawAction, status: "coming_soon" as const }];
    }
    if (rawAction === null || typeof rawAction !== "object" || Array.isArray(rawAction)) return [];

    const label = rawAction["label"];
    if (typeof label !== "string" || !label.trim()) return [];
    const rawId = rawAction["id"];
    const rawStatus = rawAction["status"];
    return [
      {
        id: typeof rawId === "string" && rawId.trim() ? rawId : label.toLowerCase(),
        label,
        status: rawStatus === "available" ? ("available" as const) : ("coming_soon" as const),
      },
    ];
  });
}

export function getLocationOpeningHours(metadataValue: Json): string | null {
  const value = metadataRecord(metadataValue)?.["opening_hours"];
  if (typeof value === "string") return value.trim() || null;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const parts = ["weekdays", "weekends", "note"].flatMap((key) => {
    const entry = value[key];
    return typeof entry === "string" && entry.trim()
      ? [`${key === "note" ? "Note" : key === "weekdays" ? "Weekdays" : "Weekends"}: ${entry}`]
      : [];
  });
  return parts.length ? parts.join(" · ") : null;
}

export function getLocationNeighborhood(location: Pick<MetadataOwner, "metadata">): string | null {
  const metadata = metadataRecord(location.metadata);
  for (const key of ["neighborhood", "neighborhood_name", "district_name", "district"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getLocationMetadataDetails(value: Json) {
  const metadata = metadataRecord(value);
  const rawCost = metadata?.["entry_cost"];
  const costAmount =
    typeof rawCost === "number"
      ? rawCost
      : rawCost !== null && typeof rawCost === "object" && !Array.isArray(rawCost)
        ? rawCost["amount"]
        : null;
  const rawAccessibility = metadata?.["accessibility"];
  return {
    neighborhoodId:
      typeof metadata?.["neighborhood_id"] === "string" ? metadata["neighborhood_id"] : null,
    entryCost:
      typeof costAmount === "number" && Number.isFinite(costAmount) && costAmount >= 0
        ? { amount: costAmount, currency: "NGN" as const }
        : null,
    interactionType:
      typeof metadata?.["interaction_type"] === "string" ? metadata["interaction_type"] : null,
    accessibility:
      Array.isArray(rawAccessibility) && rawAccessibility.every((item) => typeof item === "string")
        ? rawAccessibility
        : [],
    unlockRequirements: metadata?.["unlock_requirements"] ?? null,
  };
}

export function normalizeCityLocation(location: MapLocation): CityLocationData {
  const metadataDetails = getLocationMetadataDetails(location.metadata);
  return {
    ...location,
    category: getLocationCategory(location),
    availableActions: getLocationActions(location.metadata),
    openingHours: getLocationOpeningHours(location.metadata),
    neighborhood: getLocationNeighborhood(location),
    ...metadataDetails,
    status: location.is_active ? "active" : "inactive",
  };
}
