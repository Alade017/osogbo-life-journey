import layout from "@/data/osogbo-overview-layout.json";
import { overviewRiverDistance, overviewRiverBankWidth } from "./overview-river-layout";

const policy = layout.billboardPolicy;
type Position = { x: number; z: number };
type Footprint = { position: Position; footprint: { width: number; depth: number } };
type Billboard = Footprint & { id: string; districtId: string; brandId: string };

const occupied: Footprint[] = [
  ...layout.places,
  ...layout.residentialParcels,
  ...layout.commercialParcels,
  ...layout.terrain.river.bridges,
];
function clear(a: Footprint, b: Footprint) {
  return (
    Math.abs(a.position.x - b.position.x) >=
      (a.footprint.width + b.footprint.width) / 2 + policy.clearance ||
    Math.abs(a.position.z - b.position.z) >=
      (a.footprint.depth + b.footprint.depth) / 2 + policy.clearance
  );
}
function riverClear(position: Position) {
  return (
    overviewRiverDistance(position.x, position.z) >=
    overviewRiverBankWidth / 2 +
      Math.hypot(policy.footprint.width, policy.footprint.depth) / 2 +
      policy.clearance
  );
}
export function generateBillboards(): Billboard[] {
  const result: Billboard[] = [];
  if (!policy.brands.length) return result;
  for (const district of layout.districts) {
    const b = district.bounds;
    const candidates: Position[] = [];
    const marginX = policy.footprint.width / 2 + policy.clearance;
    const marginZ = policy.footprint.depth / 2 + policy.clearance;
    for (let z = b.z + marginZ; z <= b.z + b.depth - marginZ; z += 1) {
      for (let x = b.x + marginX; x <= b.x + b.width - marginX; x += 1) {
        candidates.push({ x, z });
      }
    }
    // Prefer exposed perimeter space, then use stable coordinate ordering.
    const edgeDistance = (p: Position) =>
      Math.min(p.x - b.x, b.x + b.width - p.x, p.z - b.z, b.z + b.depth - p.z);
    candidates.sort((a, b) => edgeDistance(a) - edgeDistance(b) || a.z - b.z || a.x - b.x);
    const limit = Math.min(
      policy.maxPerDistrict,
      Math.max(1, Math.floor((b.width * b.depth) / (policy.spacing * policy.spacing))),
    );
    let count = 0;
    for (const position of candidates) {
      if (count >= limit) break;
      const footprint = { position, footprint: policy.footprint };
      if (
        !riverClear(position) ||
        !occupied.every((p) => clear(footprint, p)) ||
        !result.every(
          (p) =>
            clear(footprint, p) &&
            Math.hypot(p.position.x - position.x, p.position.z - position.z) >= policy.spacing,
        )
      )
        continue;
      const brand = policy.brands[result.length % policy.brands.length]!;
      result.push({
        ...footprint,
        id: district.districtId + ":board:" + count,
        districtId: district.districtId,
        brandId: brand.id,
      });
      count++;
    }
  }
  return result;
}
export const overviewBillboards = generateBillboards();
