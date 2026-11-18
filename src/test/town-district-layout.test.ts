import { describe, expect, it } from "vitest";
import { townResidentialLayout } from "@/components/map/town-residential-layout";

describe("district housing composition", () => {
  const rows = ["rrrrrrrrr", "ggggggggg", "rrrrrrrrr", "ggggggggg", "rrrrrrrrr"];
  const districts = [
    { id: "market", theme: "market", gridArea: { x: 0, z: 1, width: 4, depth: 1 } },
    { id: "commerce-quarter", theme: "residential", gridArea: { x: 4, z: 1, width: 5, depth: 1 } },
    { id: "south", theme: "residential", gridArea: { x: 0, z: 3, width: 4, depth: 1 } },
    { id: "garden", theme: "leisure", gridArea: { x: 4, z: 3, width: 5, depth: 1 } },
  ];
  const input = { rows, districts, buildings: [], landmarks: [], cell: 3.6 };
  it("gives each district scenery before filling the remaining budget", () => {
    const homes = townResidentialLayout({ ...input, limit: 4 });
    expect(new Set(homes.map((h) => h.districtId)).size).toBe(4);
    expect(homes.find((h) => h.districtId === "market")?.style).toBe("terrace");
    expect(homes.find((h) => h.districtId === "commerce-quarter")?.style).toBe("apartment");
    expect(homes.find((h) => h.districtId === "garden")?.style).toBe("compound");
  });
  it("faces each building toward an actual nearby road and preserves garden gaps", () => {
    for (const home of townResidentialLayout(input)) {
      const dx = Math.round(Math.sin(home.rotation)),
        dz = Math.round(Math.cos(home.rotation));
      expect(
        rows[home.z + dz]?.[home.x + dx] === "r" ||
          rows[home.z + dz * 2]?.[home.x + dx * 2] === "r",
      ).toBe(true);
      if (home.districtId === "garden") expect((home.x + home.z) % 3).toBe(0);
    }
  });
  it("respects empty budgets and leaves unassigned district margins open", () => {
    expect(townResidentialLayout({ ...input, limit: 0 })).toEqual([]);
    expect(
      townResidentialLayout({ ...input, districts: [districts[0]!] }).every(
        (h) => h.z === 1 && h.x < 4,
      ),
    ).toBe(true);
  });
  it("preserves explicit house plots while distributing scenery", () => {
    const reservedCells = [
      [1, 1],
      [4, 1],
    ];
    const homes = townResidentialLayout({ ...input, reservedCells });
    expect(homes.every((h) => !reservedCells.some(([x, z]) => h.x === x && h.z === z))).toBe(true);
  });
});
