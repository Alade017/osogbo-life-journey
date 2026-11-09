import { describe, expect, it } from "vitest";
import { deriveTownMobilityRoutes, deriveTownPedestrianCornerRoutes, deriveTownPedestrianRoutes, deriveTownSidewalkCells } from "@/game/town-mobility";
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


describe("town sidewalk cells", () => {
  it("returns unique grass cells directly adjacent to roads", () => {
    const cells = deriveTownSidewalkCells(town.grid.rows);
    const keys = cells.map(([x, z]) => `${x},${z}`);

    expect(new Set(keys).size).toBe(cells.length);
    expect(cells.length).toBeGreaterThan(0);
    for (const [x, z] of cells) {
      expect(town.grid.rows[z]?.[x]).toBe("g");
      expect(
        [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dz]) =>
          town.grid.rows[z + dz]?.[x + dx] === "r",
        ),
      ).toBe(true);
    }
  });
});

describe("pedestrian sidewalk corner routes", () => {
  it("uses the rendered diagonal sidewalk tile to connect perpendicular sidewalk strips", () => {
    const routes = deriveTownPedestrianCornerRoutes(["gg", "rg"], 2);

    expect(routes).toEqual([
      [
        [-1, 0.28],
        [-0.28, 0.28],
        [-0.28, 1],
      ],
    ]);
  });

  it("does not create a corner connector when its diagonal tile is blocked", () => {
    expect(deriveTownPedestrianCornerRoutes(["gg", "rg"], 2, [[1, 0]])).toEqual([]);
  });

  it("does not invent corner connectors where the authored town has no rendered corner patches", () => {
    expect(deriveTownPedestrianCornerRoutes(town.grid.rows, town.grid.cellSize)).toEqual([]);
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

  it("centres pedestrian waypoints on unblocked rendered sidewalk strips", () => {
    const routes = deriveTownPedestrianRoutes(town.grid.rows, town.grid.cellSize, blockedCells);
    const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));
    const columnCount = Math.max(...town.grid.rows.map((row) => row.length));
    const expectedOffset = town.grid.cellSize / 2 + town.grid.cellSize * 0.28 / 2;

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.length).toBeGreaterThanOrEqual(3);
      for (const [worldX, worldZ] of route) {
        const gridX = worldX / town.grid.cellSize + (columnCount - 1) / 2;
        const gridZ = worldZ / town.grid.cellSize + (town.grid.rows.length - 1) / 2;
        const roadX = Math.round(gridX);
        const roadZ = Math.round(gridZ);
        const offsetX = gridX - roadX;
        const offsetZ = gridZ - roadZ;

        // The closest grid centre is the road tile; the waypoint is inset
        // from its edge by half the rendered sidewalk width.
        expect(town.grid.rows[roadZ]?.[roadX]).toBe("r");
        expect(Math.max(Math.abs(offsetX), Math.abs(offsetZ))).toBeCloseTo(expectedOffset / town.grid.cellSize);
        expect(Math.min(Math.abs(offsetX), Math.abs(offsetZ))).toBeCloseTo(0);

        const sidewalkX = roadX + Math.sign(offsetX);
        const sidewalkZ = roadZ + Math.sign(offsetZ);
        expect(town.grid.rows[sidewalkZ]?.[sidewalkX]).toBe("g");
        expect(blocked.has(`${sidewalkX},${sidewalkZ}`)).toBe(false);
      }
    }
  });


  it("preserves authored-town pedestrian route coverage before prop reservations", () => {
    const routes = deriveTownPedestrianRoutes(town.grid.rows, town.grid.cellSize, blockedCells);
    const waypointCount = routes.reduce((total, route) => total + route.length, 0);
    const routeLengths = routes.map((route) => route.length);

    // Baseline for the authored grid, before roadside prop clearance is applied in R3FTownSurface.
    expect(routes).toHaveLength(30);
    expect(waypointCount).toBe(120);
    expect(Math.min(...routeLengths)).toBe(3);
    expect(Math.max(...routeLengths)).toBe(6);
    expect(routeLengths.reduce<Record<number, number>>((counts, length) => {
      counts[length] = (counts[length] ?? 0) + 1;
      return counts;
    }, {})).toEqual({ 3: 14, 4: 5, 5: 8, 6: 3 });
  });

  it("splits both sidewalk edges at blocked sidewalk cells", () => {
    const routes = deriveTownPedestrianRoutes(
      ["rrrrrrrrr", "ggggggggg", "rrrrrrrrr"],
      2,
      [[4, 1]],
    );

    expect(routes).toHaveLength(4);
    expect(routes.every((route) => route.length === 4)).toBe(true);
  });
});
