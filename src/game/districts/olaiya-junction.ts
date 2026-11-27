import {
  fillLots,
  fillSpares,
  fillYards,
  scatterTrees,
  type DistrictLayout,
  type DistrictPlace,
  type DistrictRoad,
} from "./district-layout.ts";

// Olaiya Junction: a 400 m square district around the market crossroads. The 14 town-map
// places stand on the two market rows, with their access points on the road in front of them.

const SIZE_M = 400;

const roads: readonly DistrictRoad[] = [
  { id: "olaiya-main-road", axis: "vertical", offsetM: -40, widthM: 14, kind: "arterial" },
  { id: "olaiya-junction-road", axis: "horizontal", offsetM: 0, widthM: 14, kind: "arterial" },
  { id: "olaiya-east-road", axis: "vertical", offsetM: 120, widthM: 10, kind: "street" },
  { id: "olaiya-north-road", axis: "horizontal", offsetM: -120, widthM: 10, kind: "street" },
  { id: "olaiya-south-road", axis: "horizontal", offsetM: 120, widthM: 14, kind: "arterial" },
  { id: "olaiya-transit-lane", axis: "horizontal", offsetM: 60, widthM: 9, kind: "street" },
];

const NORTH_ACCESS_Z = -3.5; // north half of the junction road
const SOUTH_ACCESS_Z = 3.5; // south half of the junction road
const NORTH_ROW_Z = -16;
const SOUTH_ROW_Z = 16;

function rowPlace(
  id: string,
  label: string,
  kind: DistrictPlace["kind"],
  x: number,
  row: "north" | "south",
  w: number,
  d = 12,
): DistrictPlace {
  const z = row === "north" ? NORTH_ROW_Z : SOUTH_ROW_Z;
  return {
    id,
    label,
    kind,
    x,
    z,
    w,
    d,
    access: { x, z: row === "north" ? NORTH_ACCESS_Z : SOUTH_ACCESS_Z },
  };
}

const places: readonly DistrictPlace[] = [
  rowPlace("olaiya-fuel-pumps", "Fuel & Go Forecourt Pumps", "landmark", -170, "north", 10),
  rowPlace("olaiya-mini-mart", "Fuel & Go Mini-Mart", "shop", -130, "north", 10),
  rowPlace("olaiya-vulcanizer", "Vulcanizer & Tire Corner", "landmark", -90, "north", 12),
  rowPlace("olaiya-central", "Olaiya Central", "shop", -10, "north", 12),
  rowPlace("olaiya-atm", "Meridian Bank ATM Alcove", "landmark", 40, "north", 6, 6),
  rowPlace("olaiya-bank-lobby", "Meridian Bank Customer Lobby", "shop", 80, "north", 12),
  rowPlace("olaiya-adire-vats", "Indigo Dye Vats & Zinc Shed", "landmark", 150, "north", 10),
  rowPlace("olaiya-adire-racks", "Adire Drying & Folding Racks", "landmark", -170, "south", 10),
  rowPlace(
    "olaiya-market-stalls",
    "Open Market Produce & Cloth Tables",
    "landmark",
    -120,
    "south",
    10,
  ),
  rowPlace("olaiya-buka", "Mama Sikira Buka Kitchen", "shop", -10, "south", 10),
  rowPlace("olaiya-barber", "Dele Cutz Barber Salon", "shop", 40, "south", 10),
  rowPlace("olaiya-pos", "FastCash POS & Airtime Kiosk", "kiosk", 80, "south", 5, 5),
  rowPlace("olaiya-accessory", "Iya Adire Style & Accessories", "shop", 150, "south", 10),
  {
    id: "olaiya-transit",
    label: "Keke Napep & Korope Loading Stand",
    kind: "landmark",
    x: -90,
    z: 72,
    w: 12,
    d: 6,
    access: { x: -90, z: 60 },
  },
];

const doors = [
  { id: "olaiya-home-door", label: "Your home", x: -150, z: -60, w: 6, d: 6, to: "olaiya-home" },
];

const lots = fillLots(SIZE_M, roads, places, doors);
const fencedYards = fillYards(SIZE_M, roads, places, doors, lots);
// Spare ground (market pitches, parking bays, shrub beds) so no sand is left bare.
const spares = fillSpares(SIZE_M, roads, places, doors, lots, fencedYards);
const yards = [...fencedYards, ...spares];
const trees = scatterTrees(
  SIZE_M,
  roads,
  [...places, ...doors, ...lots, ...spares],
  yards,
  12,
  150,
);

export const OLAIYA_JUNCTION: DistrictLayout = {
  slug: "olaiya-junction",
  name: "Olaiya Junction",
  sizeM: SIZE_M,
  roads,
  places,
  doors,
  exits: [
    { id: "olaiya-exit-north", edge: "north", toDistrict: "ogo-oluwa", offsetM: -40 },
    { id: "olaiya-exit-south", edge: "south", toDistrict: "old-garage", offsetM: -40 },
    { id: "olaiya-exit-east", edge: "east", toDistrict: "oke-fia", offsetM: 0 },
    { id: "olaiya-exit-west", edge: "west", toDistrict: "oja-oba", offsetM: 0 },
  ],
  lots,
  yards,
  trees,
};
