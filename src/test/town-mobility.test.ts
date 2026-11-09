import { describe, expect, it } from "vitest";
import { deriveTownMobilityRoutes, deriveTownPedestrianRoutes } from "@/game/town-mobility";
import town from "@/data/osogbo-town.json";

describe("town mobility routes", () => {
  it("builds one closed loop for each adjacent road-grid block", () => {
    const routes = deriveTownMobilityRoutes(town.grid.rows, town.grid.cellSize, town.grid.cellSize * 0.22);

    // Four horizontal avenues and three continuous vertical roads form
    // three adjacent avenue pairs by two adjacent vertical-road pairs.
    expect(routes).toHaveLength(6);
    expect(routes.every((route) => route.length === 4)).toBe(true);
  });

  it("keeps the traffic path inset from each road centreline by the requested offset", () => {
    const routes = deriveTownMobilityRoutes(
      ["rrrrr", "rgggr", "rgggr", "rrrrr"],
      2,
      0.25,
    );

    expect(routes).toEqual([
      [
        [-3.75, -2.75],
        [3.75, -2.75],
        [3.75, 2.75],
        [-3.75, 2.75],
      ],
    ]);
  });

  it("rejects a rectangular loop when either vertical road edge is broken", () => {
    const routes = deriveTownMobilityRoutes(
      ["rrrrr", "rgggr", "rgggg", "rrrrr"],
      2,
    );

    expect(routes).toEqual([]);
  });

  it("keeps opposing lanes farther apart than the widest traffic body", () => {
    const cellSize = 2;
    const routes = deriveTownMobilityRoutes(
      ["rrrrrrr", "r..r..r", "rrrrrrr"],
      cellSize,
      cellSize * 0.22,
    );

    expect(routes).toHaveLength(2);
    const sharedRoadRightLane = routes[0]![1]![0];
    const sharedRoadLeftLane = routes[1]![0]![0];
    const laneSeparation = Math.abs(sharedRoadLeftLane - sharedRoadRightLane);

    // The danfo body is 0.72 units wide; leave a visible gap between opposing lanes.
    expect(laneSeparation).toBeGreaterThan(0.72);
  });

});


describe("town pedestrian routes", () => {
  const blockedCells = [
    ...town.grid.buildings.flatMap((building) =>
      [0, 1].flatMap((dx) => [0, 1].map((dz) => [building.x + dx, building.z + dz] as const)),
    ),
    ...town.grid.waterCells,
    ...town.grid.plotCells,
  ];

  it("keeps every pedestrian waypoint on an unblocked grass cell beside a road", () => {
    const routes = deriveTownPedestrianRoutes(town.grid.rows, town.grid.cellSize, blockedCells);
    const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.length).toBeGreaterThanOrEqual(3);
      for (const [worldX, worldZ] of route) {
        const x = Math.round(worldX / town.grid.cellSize + (Math.max(...town.grid.rows.map((row) => row.length)) - 1) / 2);
        const z = Math.round(worldZ / town.grid.cellSize + (town.grid.rows.length - 1) / 2);
        expect(town.grid.rows[z]?.[x]).toBe("g");
        expect(blocked.has(`${x},${z}`)).toBe(false);
        const besideRoad = [
          town.grid.rows[z]?.[x - 1],
          town.grid.rows[z]?.[x + 1],
          town.grid.rows[z - 1]?.[x],
          town.grid.rows[z + 1]?.[x],
        ].includes("r");
        expect(besideRoad).toBe(true);
      }
    }
  });

  it("splits pedestrian runs at blocked sidewalk cells", () => {
    const routes = deriveTownPedestrianRoutes(
      ["rrrrrrr", "ggggggg", "rrrrrrr"],
      2,
      [[3, 1]],
    );

    expect(routes).toHaveLength(2);
    expect(routes.every((route) => route.length >= 3)).toBe(true);
    expect(routes.flat()).not.toContainEqual([0, 0]);
  });
});
