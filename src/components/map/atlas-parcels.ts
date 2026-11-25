import parcels from "@/data/osogbo-atlas-parcels.json";
import type { TownInfillHome } from "./town-residential-layout";

export function riverOffset(x: number, z: number) {
  const end = parcels.river.findIndex((point) => point[0]! >= x);
  const b = parcels.river[Math.max(1, end < 0 ? parcels.river.length - 1 : end)]!;
  const a = parcels.river[Math.max(0, parcels.river.indexOf(b) - 1)]!;
  return z - (a[1]! + ((b[1]! - a[1]!) * (x - a[0]!)) / (b[0]! - a[0]!));
}

export const inEstate = (x: number, z: number) =>
  parcels.estates.some(
    (e) => x >= e.x - 0.5 && x < e.x + e.columns - 0.5 && z >= e.z - 0.5 && z < e.z + e.rows - 0.5,
  );

export function estateHomes(): TownInfillHome[] {
  return parcels.estates.flatMap((e) =>
    Array.from({ length: e.columns * e.rows }, (_, i) => ({
      x: e.x + (i % e.columns),
      z: e.z + Math.floor(i / e.columns),
      districtId: e.districtId,
      style: e.style as TownInfillHome["style"],
      rotation: (Math.floor(i / e.columns) % 2) * Math.PI,
      floors: e.style === "apartment" ? 3 : 1,
    })),
  );
}

export const atlasMarkets = new Set(["oja-oba-market", "town-market"]);
const transit = new Set(["east-transit-terminal", "transit-park"]);
export const hasSignatureLandmark = (id: string) =>
  atlasMarkets.has(id) || transit.has(id) || id === "osogbo-township-stadium" || id === "osun-mall";
