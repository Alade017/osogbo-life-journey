import { WORLD_PALETTE } from "@/components/3d/world-theme";
/** Game design dimensions, not a real-world hospital compliance specification. One tile = 1 scene metre. */
export type ClinicRect = { x: number; z: number; width: number; depth: number };
export type ClinicRoom = ClinicRect & { id: string; name: string; doorX: number; color: string };
export const CLINIC_ROOMS: readonly ClinicRoom[] = [
  { id: "exam", name: "Examination", x: 0, z: 0, width: 6, depth: 6, doorX: 3, color: WORLD_PALETTE.tileBath },
  { id: "staff", name: "Staff room", x: 6, z: 0, width: 6, depth: 6, doorX: 9, color: WORLD_PALETTE.timber },
  {
    id: "restroom",
    name: "Restroom",
    x: 12,
    z: 3,
    width: 3,
    depth: 3,
    doorX: 13.5,
    color: WORLD_PALETTE.tileBathShade,
  },
  {
    id: "supply",
    name: "Supplies",
    x: 15,
    z: 0,
    width: 3,
    depth: 6,
    doorX: 16.5,
    color: WORLD_PALETTE.concrete,
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    x: 18,
    z: 0,
    width: 6,
    depth: 6,
    doorX: 21,
    color: WORLD_PALETTE.cityLawn,
  },
  {
    id: "reception",
    name: "Reception",
    x: 0,
    z: 10,
    width: 10,
    depth: 8,
    doorX: 8,
    color: WORLD_PALETTE.tileLight,
  },
  {
    id: "waiting",
    name: "Waiting lounge",
    x: 14,
    z: 10,
    width: 10,
    depth: 8,
    doorX: 16,
    color: WORLD_PALETTE.tileLight,
  },
];
export const CLINIC_CORRIDORS: readonly ClinicRect[] = [
  { x: 0, z: 6, width: 24, depth: 4 },
  { x: 10, z: 10, width: 4, depth: 8 },
];
export const CLINIC_PARKING = Array.from({ length: 6 }, (_, i) => ({
  x: -11 + i * 3.2,
  z: 18,
  width: 2.8,
  depth: 5,
}));
export const CLINIC_ENTRY = { x: 12, z: 18, width: 2 };
export function clinicRoomAt(x: number, z: number) {
  return CLINIC_ROOMS.find((r) => x >= r.x && x < r.x + r.width && z >= r.z && z < r.z + r.depth);
}
