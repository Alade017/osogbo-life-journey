/** Presentation geometry only; these values never control jobs, salaries or course progress. */
export const WORKPLACE_LAYOUT = { width: 14, depth: 12, cameraWidth: 16, cameraDepth: 14 } as const;
export const WORKPLACE_FEATURES = ["workstations", "presentation", "equipment", "reception", "training"] as const;
export type WorkplaceFeature = (typeof WORKPLACE_FEATURES)[number];
