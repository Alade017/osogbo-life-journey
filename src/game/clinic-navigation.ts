import { CLINIC_ROOMS, CLINIC_CORRIDORS, type ClinicRect } from "./tier-one-clinic";
export type ClinicPoint = readonly [number, number];
export const CLINIC_SPAWN: ClinicPoint = [12, 17];
const RADIUS = 0.38;
/** Physical prop footprints for the authored room furniture, in layout coordinates. */
export const CLINIC_SOLIDS: readonly ClinicRect[] = [
  { x: 2.3, z: 1.9, width: 1.4, depth: 2.2 },
  { x: 0, z: 0.6, width: 2.5, depth: 0.8 },
  { x: 5.25, z: 0.65, width: 0.5, depth: 1.3 },
  { x: 12.5, z: 3.25, width: 0.6, depth: 0.9 },
  { x: 13.975, z: 3.35, width: 0.65, depth: 0.5 },
  { x: 18.3, z: 0.15, width: 0.8, depth: 1.05 },
  { x: 22.9, z: 0.15, width: 0.8, depth: 1.05 },
  { x: 19.75, z: 3.6, width: 2.5, depth: 0.8 },
  { x: 2.75, z: 12.6, width: 2.5, depth: 0.8 },
  { x: 1.075, z: 15.8, width: 0.45, depth: 0.4 },
  { x: 17.7, z: 12.2, width: 2.6, depth: 0.7 },
  { x: 17.7, z: 15.2, width: 2.6, depth: 0.7 },
  { x: 22.4, z: 10.75, width: 0.8, depth: 0.5 },
];
const inside = (p: ClinicPoint, r: ClinicRect, margin = 0) =>
  p[0] >= r.x + margin &&
  p[0] <= r.x + r.width - margin &&
  p[1] >= r.z + margin &&
  p[1] <= r.z + r.depth - margin;
const walls: ClinicRect[] = CLINIC_ROOMS.flatMap((r) => {
  const z = r.z < 6 ? r.z + r.depth : r.z;
  return [
    { x: r.x - 0.06, z: r.z, width: 0.12, depth: r.depth },
    { x: r.x + r.width - 0.06, z: r.z, width: 0.12, depth: r.depth },
    { x: r.x, z: z - 0.06, width: r.doorX - 0.8 - r.x, depth: 0.12 },
    { x: r.doorX + 0.8, z: z - 0.06, width: r.x + r.width - r.doorX - 0.8, depth: 0.12 },
  ];
});
export function canWalkClinic(p: ClinicPoint) {
  if (
    !p.every(Number.isFinite) ||
    p[0] < RADIUS ||
    p[0] > 24 - RADIUS ||
    p[1] < RADIUS ||
    p[1] > 18 - RADIUS
  )
    return false;
  const blocked = CLINIC_ROOMS.filter((r) => r.id === "staff" || r.id === "supply");
  if (blocked.some((r) => inside(p, r, -RADIUS))) return false;
  if ([...CLINIC_SOLIDS, ...walls].some((r) => inside(p, r, -RADIUS))) return false;
  if (CLINIC_CORRIDORS.some((r) => inside(p, r))) return true;
  for (const r of CLINIC_ROOMS) {
    if (inside(p, r, RADIUS)) return true;
    const doorZ = r.z < 6 ? r.z + r.depth : r.z;
    if (Math.abs(p[0] - r.doorX) <= 0.8 - RADIUS && Math.abs(p[1] - doorZ) <= RADIUS + 0.05)
      return true;
  }
  return false;
}
/** Half-tile four-neighbour BFS; no diagonal corner cutting or through-wall shortcuts. */
export function clinicPath(from: ClinicPoint, to: ClinicPoint): ClinicPoint[] | null {
  const snap = (p: ClinicPoint): ClinicPoint => [
    Math.round(p[0] * 2) / 2,
    Math.round(p[1] * 2) / 2,
  ];
  const start = snap(from),
    end = snap(to),
    key = (p: ClinicPoint) => `${p[0]},${p[1]}`;
  if (!canWalkClinic(from) || !canWalkClinic(to) || !canWalkClinic(start) || !canWalkClinic(end))
    return null;
  const segmentClear = (a: ClinicPoint, b: ClinicPoint) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.1));
    return Array.from({ length: steps + 1 }, (_, i) => i / steps).every((t) =>
      canWalkClinic([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t]),
    );
  };
  if (!segmentClear(from, start) || !segmentClear(end, to)) return null;
  const queue: ClinicPoint[] = [start],
    parents = new Map<string, ClinicPoint | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (key(p) === key(end)) {
      const route: ClinicPoint[] = [];
      for (let at: ClinicPoint | null = p; at; at = parents.get(key(at)) ?? null) route.push(at);
      return [from, ...route.reverse(), to];
    }
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ] as const) {
      const next: ClinicPoint = [p[0] + dx, p[1] + dz];
      if (
        parents.has(key(next)) ||
        !canWalkClinic(next) ||
        !canWalkClinic([(p[0] + next[0]) / 2, (p[1] + next[1]) / 2])
      )
        continue;
      parents.set(key(next), p);
      queue.push(next);
    }
  }
  return null;
}
export const CLINIC_ROOM_APPROACH: Readonly<Record<string, ClinicPoint>> = {
  reception: [7, 13],
  waiting: [16, 14],
  exam: [4.5, 4.5],
  restroom: [13.5, 5],
  pharmacy: [21, 5],
};
