import { WORLD_PALETTE } from "@/components/3d/world-theme";
/** Scene layout only; course costs, eligibility and completion remain in education RPCs. */
export const CAMPUS_AREAS = [
  {
    id: "courtyard",
    name: "Campus grounds",
    detail: "Entrance gate, shaded courtyard and paths to the teaching blocks.",
    width: 34,
    depth: 32,
  },
  {
    id: "classroom",
    name: "Classroom",
    detail:
      "Teaching board and arranged desks. Open courses to see the available learning options.",
    width: 15,
    depth: 13,
  },
  {
    id: "library",
    name: "Campus library",
    detail:
      "Book stacks and study tables. This is a campus reading space, separate from Old Town Library.",
    width: 15,
    depth: 13,
  },
  {
    id: "administration",
    name: "Administration",
    detail:
      "Reception, visitor seats and records storage. Enrolment stays in the existing education flow.",
    width: 15,
    depth: 13,
  },
] as const;
export type CampusAreaId = (typeof CAMPUS_AREAS)[number]["id"];
export function campusArea(id: CampusAreaId) {
  return CAMPUS_AREAS.find((area) => area.id === id)!;
}
export const CAMPUS_BUILDINGS = [
  { id: "classroom" as const, x: -9, z: -5, width: 8, depth: 7, color: WORLD_PALETTE.accent },
  { id: "library" as const, x: 9, z: -5, width: 8, depth: 7, color: WORLD_PALETTE.foliage },
  { id: "administration" as const, x: 0, z: -10, width: 6, depth: 5, color: WORLD_PALETTE.concrete },
];

export const CAMPUS_PATHS = [
  { x: 0, z: 3.75, width: 4, depth: 22.5 },
  { x: 0, z: 0, width: 25, depth: 2.5 },
  { x: -9, z: -0.75, width: 2.5, depth: 1.5 },
  { x: 9, z: -0.75, width: 2.5, depth: 1.5 },
] as const;
