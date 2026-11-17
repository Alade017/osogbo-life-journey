import { CAMPUS_BUILDINGS, CAMPUS_PATHS, type CampusAreaId } from "./school-campus";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";
export type CampusSolid = { x: number; z: number; width: number; depth: number };
const RADIUS = 0.38;
export const CAMPUS_ENTRY: WalkPoint = [0, 12];
export const CAMPUS_ROOM_ENTRY: WalkPoint = [0, 4];
export const CAMPUS_INTERIOR_TARGETS: Readonly<
  Record<Exclude<CampusAreaId, "courtyard">, WalkPoint>
> = { classroom: [0, -3], library: [0, -2.5], administration: [0, 0.5] };
export const CAMPUS_DESKS = [-3, 0, 3].flatMap((x) => [-0.7, 1.6].map((z) => ({ x, z })));
export const CAMPUS_STUDY_TABLES = [-2.6, 2.6].map((x) => ({ x, z: 0.8 }));
const chair = (x: number, z: number): CampusSolid => ({ x, z: z + 0.025, width: 0.6, depth: 0.65 });
function createCampusSolids(area: CampusAreaId): CampusSolid[] {
  if (area === "courtyard")
    return CAMPUS_BUILDINGS.map((b) => ({ x: b.x, z: b.z, width: b.width, depth: b.depth }));
  if (area === "classroom")
    return [
      ...CAMPUS_DESKS.flatMap((p) => [{ ...p, width: 1.6, depth: 0.85 }, chair(p.x, p.z + 1)]),
      { x: 3.7, z: -3, width: 2, depth: 0.85 },
    ];
  if (area === "library")
    return [
      ...[-3.8, 0, 3.8].map((x) => ({ x, z: -4.1, width: 2.2, depth: 0.8 })),
      ...CAMPUS_STUDY_TABLES.flatMap((p) => [
        { ...p, width: 2.8, depth: 0.85 },
        chair(p.x - 0.8, p.z + 1),
        chair(p.x + 0.8, p.z + 1),
      ]),
    ];
  return [
    { x: 0, z: -1, width: 3.5, depth: 0.85 },
    { x: -4, z: -4, width: 2.2, depth: 0.8 },
    { x: 3.7, z: -4, width: 2, depth: 0.7 },
    ...[-2, 0, 2].map((x) => chair(x, 2.4)),
  ];
}
const CAMPUS_COLLISIONS = {
  courtyard: createCampusSolids("courtyard"),
  classroom: createCampusSolids("classroom"),
  library: createCampusSolids("library"),
  administration: createCampusSolids("administration"),
};
export function campusSolids(area: CampusAreaId): readonly CampusSolid[] {
  return CAMPUS_COLLISIONS[area];
}
export function campusEntrance(area: Exclude<CampusAreaId, "courtyard">): WalkPoint {
  const b = CAMPUS_BUILDINGS.find((b) => b.id === area)!;
  return [b.x, b.z + b.depth / 2 + 0.75];
}
export function canWalkCampus(area: CampusAreaId, p: WalkPoint) {
  if (!p.every(Number.isFinite)) return false;
  const width = area === "courtyard" ? 32 : 11.8,
    depth = area === "courtyard" ? 30 : 9.7;
  if (Math.abs(p[0]) > width / 2 - RADIUS || Math.abs(p[1]) > depth / 2 - RADIUS) return false;
  if (area === "courtyard") {
    const inPaths = (x: number, z: number) =>
      CAMPUS_PATHS.some(
        (path) => Math.abs(x - path.x) <= path.width / 2 && Math.abs(z - path.z) <= path.depth / 2,
      );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      if (!inPaths(p[0] + Math.cos(a) * RADIUS, p[1] + Math.sin(a) * RADIUS)) return false;
    }
  }
  return !campusSolids(area).some(
    (s) =>
      Math.abs(p[0] - s.x) < s.width / 2 + RADIUS && Math.abs(p[1] - s.z) < s.depth / 2 + RADIUS,
  );
}
export function campusWalkPath(area: CampusAreaId, from: WalkPoint, to: WalkPoint) {
  return findGridWalkPath(from, to, (p) => canWalkCampus(area, p));
}
