import { describe, expect, it } from "vitest";
import layout from "@/data/osogbo-overview-layout.json";
import { generateBillboards, overviewBillboards } from "@/components/map/overview-billboard-placement";
import { overviewFit, overviewClampZoom, overviewPanCorrection } from "@/components/map/overview-camera";

describe("overview billboard placement", () => {
  const policy = layout.billboardPolicy;
  it("generates stable unique placements and retains both configured brands", () => {
    expect(generateBillboards()).toEqual(overviewBillboards);
    expect(new Set(overviewBillboards.map(b => b.id)).size).toBe(overviewBillboards.length);
    expect(new Set(overviewBillboards.map(b => b.brandId))).toEqual(new Set(policy.brands.map(b => b.id)));
    expect(policy.brands.some(b => b.name === "ELEGANCE" && b.subtitle === "TECH HUB")).toBe(true);
  });
  it("keeps sites inside district bounds and respects district capacity", () => {
    for (const district of layout.districts) {
      const boards = overviewBillboards.filter(b => b.districtId === district.districtId);
      expect(boards.length).toBeGreaterThan(0);
      expect(boards.length).toBeLessThanOrEqual(policy.maxPerDistrict);
      for (const board of boards) {
        const { x, z } = board.position, { width, depth } = board.footprint, b = district.bounds;
        expect(x-width/2).toBeGreaterThanOrEqual(b.x);
        expect(x+width/2).toBeLessThanOrEqual(b.x+b.width);
        expect(z-depth/2).toBeGreaterThanOrEqual(b.z);
        expect(z+depth/2).toBeLessThanOrEqual(b.z+b.depth);
      }
    }
  });
  it("avoids buildings, bridges and neighboring billboards", () => {
    const occupied = [...layout.places,...layout.residentialParcels,...layout.commercialParcels,...layout.terrain.river.bridges];
    for (const [index, a] of overviewBillboards.entries()) {
      for (const b of [...occupied,...overviewBillboards.slice(index+1)]) {
        expect(Math.abs(a.position.x-b.position.x) >= (a.footprint.width+b.footprint.width)/2+policy.clearance ||
          Math.abs(a.position.z-b.position.z) >= (a.footprint.depth+b.footprint.depth)/2+policy.clearance).toBe(true);
      }
      for (const b of overviewBillboards.slice(index+1)) {
        expect(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)).toBeGreaterThanOrEqual(policy.spacing);
      }
    }
  });
});

describe("overview camera constraints", () => {
  it("fits the shorter viewport dimension and protects a zero-size viewport", () => {
    expect(overviewFit(360,800,100,100)).toBeCloseTo(overviewFit(800,360,100,100));
    expect(overviewFit(0,0,100,100)).toBe(0.01);
  });
  it("clamps zoom to the configured fit range", () => {
    expect(overviewClampZoom(0,2)).toBe(2);
    expect(overviewClampZoom(6,2)).toBe(6);
    expect(overviewClampZoom(20,2)).toBe(10);
  });
  it("keeps the target on the map plane and inside authored bounds", () => {
    expect(overviewPanCorrection(80,4,-70,100,80)).toEqual([-30,-4,30]);
    expect(overviewPanCorrection(0,0,0,100,100).every(v=>v===0)).toBe(true);
  });
});
