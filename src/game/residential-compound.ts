import housing from "@/data/housing.json";

/** Local presentation footprint; never used for tenancy, map positions or ownership. */
export const RESIDENTIAL_COMPOUND = {
  width: 20,
  depth: 20,
  cameraWidth: 23,
  cameraDepth: 23,
  privateFronts: [
    { x: -7, z: 0, rotation: Math.PI / 2 },
    { x: 7, z: 0, rotation: -Math.PI / 2 },
  ],
} as const;
export const COMPOUND_FEATURES = [
  {
    id: "courtyard",
    label: "Courtyard seating",
    detail: "Shared outdoor seating beside the clear entrance path.",
    x: -2.6,
    z: 1.3,
  },
  {
    id: "water",
    label: "Water point",
    detail: "The compound water tank and tap. Inspecting this feature does not change needs.",
    x: -6.5,
    z: 6,
  },
  {
    id: "drying",
    label: "Drying area",
    detail: "A shared outdoor drying line. This inspection does not move or clean inventory items.",
    x: 5.5,
    z: 6,
  },
  {
    id: "gate",
    label: "Compound gate",
    detail: "The main pedestrian entrance to the courtyard.",
    x: 0,
    z: 8.9,
  },
  {
    id: "home-entry",
    label: "House entrances",
    detail:
      "Other residents' doors are private. Your confirmed home uses the existing home-entry flow.",
    x: 0,
    z: -1.1,
  },
  {
    id: "wash",
    label: "Shared wash area",
    detail:
      "Shared washing facilities for the room types configured to use them. Services remain in the existing home flow.",
    x: 6.3,
    z: -6.2,
    sharedOnly: true,
  },
] as const;
export type CompoundFeatureId = (typeof COMPOUND_FEATURES)[number]["id"];

export function residentialHomePresentation(homeTypeId: string | null | undefined) {
  const type = housing.find((entry) => entry.id === homeTypeId);
  return type
    ? {
        id: type.id,
        name: type.name,
        floors: type.floors,
        sharedFacilities: type.shared_facilities,
      }
    : null;
}
export function compoundFeatures(sharedFacilities = false) {
  return COMPOUND_FEATURES.filter((feature) => !("sharedOnly" in feature) || sharedFacilities);
}
