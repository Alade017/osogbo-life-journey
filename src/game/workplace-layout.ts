/** Presentation geometry only; these values never control jobs, salaries or course progress. */
export const WORKPLACE_LAYOUT = {
  width: 14,
  depth: 12,
  cameraWidth: 16,
  cameraDepth: 14,
  wallHeight: 3.6,
  entranceWidth: 2.2,
  aisle: { width: 1.8, startZ: -3.4, endZ: 6 },
  window: { centers: [-4.8, 4.8], width: 2.6, bottom: 1.3, height: 1.8 },
} as const;
export const WORKPLACE_FEATURES = [
  "workstations",
  "presentation",
  "equipment",
  "reception",
  "training",
] as const;
export type WorkplaceFeature = (typeof WORKPLACE_FEATURES)[number];

/** Full visual footprints, including pulled-out seats; also used by selection outlines. */
export const WORKPLACE_FOOTPRINTS: Record<WorkplaceFeature, { width: number; depth: number }> = {
  workstations: { width: 3.5, depth: 3.05 },
  presentation: { width: 4.2, depth: 0.3 },
  equipment: { width: 1.3, depth: 0.9 },
  reception: { width: 3, depth: 1.1 },
  training: { width: 3.2, depth: 2.95 },
};
