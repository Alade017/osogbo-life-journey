import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  BusFront,
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
  home: { label: "Homes", singular: "Home", icon: House, colour: "#687c55" },
  bank: { label: "Banks", singular: "Bank", icon: Banknote, colour: "#4f8062" },
  hospital: { label: "Hospitals", singular: "Hospital", icon: Hospital, colour: "#a84e52" },
  police: { label: "Police stations", singular: "Police station", icon: Shield, colour: "#536c89" },
  market: { label: "Markets", singular: "Market", icon: Store, colour: "#bd6046" },
  restaurant: { label: "Restaurants", singular: "Restaurant", icon: Utensils, colour: "#d47a43" },
  fuel_station: { label: "Fuel stations", singular: "Fuel station", icon: Fuel, colour: "#bd8737" },
  school: { label: "Schools", singular: "School", icon: GraduationCap, colour: "#657caa" },
  business: {
    label: "Businesses",
    singular: "Business",
    icon: BriefcaseBusiness,
    colour: "#537e79",
  },
  government: { label: "Government", singular: "Government", icon: Landmark, colour: "#936a38" },
  entertainment: {
    label: "Entertainment",
    singular: "Entertainment",
    icon: Music2,
    colour: "#9c5e8b",
  },
  park: { label: "Parks", singular: "Park", icon: TreePine, colour: "#527b52" },
  cultural_landmark: {
    label: "Cultural landmarks",
    singular: "Cultural landmark",
    icon: Landmark,
    colour: "#927344",
  },
  transportation: {
    label: "Transport points",
    singular: "Transport point",
    icon: BusFront,
    colour: "#bd8737",
  },
  other: { label: "Other locations", singular: "Other", icon: MapPin, colour: "#66746c" },
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
  status: "active" | "inactive";
};

const LEGACY_TYPE_CATEGORY: Record<string, LocationCategory> = {
  residential: "home",
  bank: "bank",
  hospital: "hospital",
  police: "police",
  market: "market",
  restaurant: "restaurant",
  school: "school",
  university: "school",
  workplace: "business",
  shop: "business",
  government: "government",
  entertainment: "entertainment",
  transport: "transportation",
  landmark: "cultural_landmark",
  custom: "other",
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

export function normalizeCityLocation(location: MapLocation): CityLocationData {
  return {
    ...location,
    category: getLocationCategory(location),
    availableActions: getLocationActions(location.metadata),
    openingHours: getLocationOpeningHours(location.metadata),
    status: location.is_active ? "active" : "inactive",
  };
}
