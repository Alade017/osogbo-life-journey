import {
  Banknote,
  Building2,
  BusFront,
  GraduationCap,
  Hospital,
  Landmark,
  MapPin,
  Music2,
  School,
  Shield,
  ShoppingBag,
  Store,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LOCATION_ICONS: Record<string, LucideIcon> = {
  government: Landmark,
  market: Store,
  shop: ShoppingBag,
  restaurant: Utensils,
  bank: Banknote,
  hospital: Hospital,
  police: Shield,
  school: School,
  university: GraduationCap,
  entertainment: Music2,
  transport: BusFront,
  residential: Building2,
  workplace: Building2,
  landmark: MapPin,
  custom: MapPin,
};

export const LOCATION_TYPE_COLOURS: Record<string, string> = {
  government: "#936a38",
  market: "#bd6046",
  shop: "#ad6c4e",
  restaurant: "#d47a43",
  bank: "#4f8062",
  hospital: "#a84e52",
  police: "#536c89",
  school: "#657caa",
  university: "#596a9e",
  entertainment: "#9c5e8b",
  transport: "#bd8737",
  residential: "#687c55",
  workplace: "#537e79",
  landmark: "#927344",
  custom: "#66746c",
};

export function locationTypeColour(type: string) {
  return LOCATION_TYPE_COLOURS[type] ?? LOCATION_TYPE_COLOURS.custom;
}
