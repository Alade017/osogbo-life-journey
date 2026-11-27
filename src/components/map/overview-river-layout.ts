import { CatmullRomCurve3, Vector3 } from "three";
import layout from "@/data/osogbo-overview-layout.json";

const river = layout.terrain.river;
const points = river.centerline.map((p) => new Vector3(p.x, 0, p.z));
const curve = new CatmullRomCurve3(points);
export const overviewRiverSamples = curve.getPoints(Math.max(24, (points.length - 1) * 12));
export const overviewRiverBankWidth = river.width + 0.65;

/** Distance to the same sampled centerline used to render the water and banks. */
export function overviewRiverDistance(x: number, z: number): number {
  let distance = Infinity;
  for (let i = 1; i < overviewRiverSamples.length; i++) {
    const a = overviewRiverSamples[i - 1]!;
    const b = overviewRiverSamples[i]!;
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
    );
    distance = Math.min(distance, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return distance;
}
