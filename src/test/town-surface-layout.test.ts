import { describe, expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { townSurfaceLayout, TOWN_SURFACE } from "@/components/map/town-surface-layout";
import { townResidentialLayout } from "@/components/map/town-residential-layout";

describe("solid town terrain", () => {
  it("covers the full authored layout without covering road surfaces", () => {
    const terrain = townSurfaceLayout(town.grid.rows, 3.6);
    expect(terrain.depth).toBe(town.meta.grid.rows * 3.6);
    expect(terrain.width).toBe(town.meta.grid.columns * 3.6);
    for (const tile of terrain.land)
      expect(tile.position[1] + tile.scale![1] / 2).toBeLessThan(0.03);
    expect(terrain.land.length + terrain.water.length).toBe(
      town.meta.grid.rows * town.meta.grid.columns,
    );
  });
  it("leaves real openings above water instead of hiding it under a full ground slab", () => {
    const terrain = townSurfaceLayout(["ggg", "gwg", "ggg"], 3.6);
    expect(terrain.water).toHaveLength(1);
    const water = terrain.water[0]!;
    expect(water.position[1] + water.scale![1] / 2).toBeCloseTo(TOWN_SURFACE.waterTop);
    expect(terrain.land.some((tile) => tile.position[0] === 0 && tile.position[2] === 0)).toBe(
      false,
    );
    expect(terrain.banks).toHaveLength(4);
  });
  it("keeps decorative housing off roads, water, authored venues and reserved properties", () => {
    const input = {
      rows: town.grid.rows,
      buildings: town.grid.buildings,
      landmarks: town.landmarks,
      cell: 3.6,
    };
    const homes = townResidentialLayout(input);
    expect(homes.length).toBeGreaterThan(0);
    for (const home of homes) {
      expect(town.grid.rows[home.z]![home.x]).toBe("g");
      expect(
        town.grid.buildings.some(
          (b) => Math.abs(home.x - b.x - 0.5) < 1.15 && Math.abs(home.z - b.z - 0.5) < 1.15,
        ),
      ).toBe(false);
    }
    const first = homes[0]!;
    const reserved = [
      [
        (first.x - (town.meta.grid.columns - 1) / 2) * 3.6,
        (first.z - (town.meta.grid.rows - 1) / 2) * 3.6,
      ] as const,
    ];
    expect(
      townResidentialLayout({ ...input, reserved }).some(
        (home) => home.x === first.x && home.z === first.z,
      ),
    ).toBe(false);
    expect(townResidentialLayout(input)).toEqual(homes);
  });
});
