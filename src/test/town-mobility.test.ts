import { describe, expect, it } from "vitest";
import { isValidTownMobilityLoop, townPedestrianClearanceRadius, isValidTownPedestrianRoute, measureTownMobilityLoop, deriveTownMobilityRoutes, deriveTownPedestrianCornerRoutes, deriveTownPedestrianRoutes, deriveTownSidewalkCells, stitchTownPedestrianRoutes, TownPedestrianJunctionScheduler } from "@/game/town-mobility";
import town from "@/data/osogbo-town.json";

describe("pedestrian junction clearance", () => {
  it("reduces clearance on short trails while preserving the preferred radius on long trails", () => {
    expect(townPedestrianClearanceRadius(4)).toBe(0.38);
    expect(townPedestrianClearanceRadius(0.6)).toBeCloseTo(0.2);
    expect(townPedestrianClearanceRadius(0)).toBe(0);
    expect(townPedestrianClearanceRadius(Number.NaN)).toBe(0);
  });
});

describe("pedestrian route validation", () => {
  it("rejects non-finite and zero-length trails before NPC assignment", () => {
    expect(isValidTownPedestrianRoute([[0, 0], [1, 0]])).toBe(true);
    expect(isValidTownPedestrianRoute([[0, 0], [0, 0]])).toBe(false);
    expect(isValidTownPedestrianRoute([[0, 0], [Number.NaN, 1]])).toBe(false);
    expect(isValidTownPedestrianRoute([[0, 0], [Number.POSITIVE_INFINITY, 1]])).toBe(false);
  });
});

describe("town mobility input validation", () => {
  it("returns no traffic or pedestrian routes for invalid cell dimensions", () => {
    const rows = ["rrrr", "rggg", "rrrr"];

    for (const cellSize of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(deriveTownMobilityRoutes(rows, cellSize)).toEqual([]);
      expect(deriveTownPedestrianRoutes(rows, cellSize, [])).toEqual([]);
      expect(deriveTownPedestrianCornerRoutes(rows, cellSize)).toEqual([]);
    }
  });

  it("rejects non-finite lane offsets and invalid sidewalk widths", () => {
    const rows = ["rrrr", "rgrr", "rrrr"];

    expect(deriveTownMobilityRoutes(rows, 2, Number.NaN)).toEqual([]);
    expect(deriveTownPedestrianRoutes(rows, 2, [], -0.1)).toEqual([]);
    expect(deriveTownPedestrianCornerRoutes(rows, 2, [], Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe("traffic loop validation", () => {
  it("rejects malformed or non-traversable vehicle loops", () => {
    expect(isValidTownMobilityLoop([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(true);
    expect(isValidTownMobilityLoop([[0, 0], [1, 0]])).toBe(false);
    expect(isValidTownMobilityLoop([[0, 0], [1, 0], [2, 0]])).toBe(false);
    expect(isValidTownMobilityLoop([[0, 0], [1, 0], [1, 1], [1, 0]])).toBe(false);
    expect(isValidTownMobilityLoop([[0, 0], [Number.NaN, 1], [1, 1]])).toBe(false);
    expect(isValidTownMobilityLoop([[0, 0], [0, 0], [1, 1]])).toBe(false);
    expect(isValidTownMobilityLoop([[0, 0]])).toBe(false);
  });
});

describe("town traffic loop measurement", () => {
  it("measures only finite, traversable edges in a closed traffic loop", () => {
    expect(measureTownMobilityLoop([[0, 0], [0.0005, 0], [1, 0], [Number.NaN, 2]])).toBeCloseTo(1);
    expect(measureTownMobilityLoop([[0, 0], [0.0005, 0], [0, 0]])).toBe(0);
  });
});

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
  it("turns through the diagonal sidewalk patch between perpendicular road edges", () => {
    const routes = deriveTownPedestrianCornerRoutes(["rrr", "rgr", "rrr"], 2);

    expect(routes).toEqual([
      [[-2, -0.72], [-0.72, -0.72], [-0.72, -2]],
      [[2, -0.72], [0.72, -0.72], [0.72, -2]],
      [[-2, 0.72], [-0.72, 0.72], [-0.72, 2]],
      [[2, 0.72], [0.72, 0.72], [0.72, 2]],
    ]);
  });

  it("does not create a corner connector when its diagonal tile is blocked", () => {
    expect(deriveTownPedestrianCornerRoutes(["rrr", "rgr", "rrr"], 2, [[1, 1]])).toEqual([]);
  });

  it("finds all eligible outer corners in the authored town grid", () => {
    expect(deriveTownPedestrianCornerRoutes(town.grid.rows, town.grid.cellSize)).toHaveLength(48);
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


describe("stitched pedestrian sidewalk network", () => {
  it("joins straight runs through a shared corner connector without losing geometry", () => {
    const routes = stitchTownPedestrianRoutes([
      [[-2, -0.72], [0, -0.72]],
      [[0, -0.72], [0.72, -0.72], [0.72, -2]],
    ]);

    expect(routes).toEqual([
      [[-2, -0.72], [0, -0.72], [0.72, -0.72], [0.72, -2]],
    ]);
  });

  it("splits at junction branches instead of arbitrarily routing through them", () => {
    const routes = stitchTownPedestrianRoutes([
      [[-1, 0], [0, 0]],
      [[0, 0], [1, 0]],
      [[0, 0], [0, 1]],
    ]);

    expect(routes).toHaveLength(3);
    expect(routes.every((route) => route.length === 2)).toBe(true);
  });

  it("retains every valid segment exactly once", () => {
    const input = [
      [[0, 0], [1, 0], [2, 0]],
      [[2, 0], [2, 1], [2, 2]],
    ] as const;
    const output = stitchTownPedestrianRoutes(input);
    const segmentCount = output.reduce((sum, route) => sum + route.length - 1, 0);

    expect(segmentCount).toBe(4);
    expect(output).toHaveLength(1);
  });

  it("consumes closed degree-two loops without dropping or duplicating edges", () => {
    const output = stitchTownPedestrianRoutes([
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
    ]);
    const edgeKeys = output.flatMap((route) => route.slice(1).map((point, index) => {
      const previous = route[index]!;
      const currentKey = `${point[0]},${point[1]}`;
      const previousKey = `${previous[0]},${previous[1]}`;
      return previousKey < currentKey
        ? `${previousKey}|${currentKey}`
        : `${currentKey}|${previousKey}`;
    }));

    expect(output).toHaveLength(1);
    expect(output[0]).toHaveLength(5);
    expect(output[0]?.[0]).toEqual(output[0]?.[4]);
    expect(new Set(edgeKeys).size).toBe(4);
  });
});


describe("pedestrian route stitching edge deduplication", () => {
  it("skips segments containing non-finite coordinates without losing valid segments", () => {
    const routes = stitchTownPedestrianRoutes([
      [[0, 0], [1, 0], [Number.NaN, 2], [2, 0], [3, 0]],
      [[3, 0], [Number.POSITIVE_INFINITY, 1]],
    ]);

    expect(routes).toEqual([[[0, 0], [1, 0]], [[2, 0], [3, 0]]]);
    expect(routes.flat().every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))).toBe(true);
  });

  it("does not duplicate a shared segment supplied in opposite directions", () => {
    const routes = stitchTownPedestrianRoutes([
      [[0, 0], [1, 0]],
      [[1, 0], [0, 0]],
    ]);

    expect(routes).toEqual([[[0, 0], [1, 0]]]);
  });

  it("discards zero-length and near-zero segments without breaking valid runs", () => {
    const routes = stitchTownPedestrianRoutes([
      [[0, 0], [0, 0], [0.0005, 0], [1, 0], [2, 0]],
    ]);

    expect(routes).toEqual([[[0.0005, 0], [1, 0], [2, 0]]]);
  });
});


describe("pedestrian junction reservations", () => {
  it("grants exclusive access and serves queued pedestrians in arrival order", () => {
    const scheduler = new TownPedestrianJunctionScheduler();

    expect(scheduler.request("junction-a", "pedestrian-1")).toBe(true);
    expect(scheduler.request("junction-a", "pedestrian-2")).toBe(false);
    expect(scheduler.request("junction-a", "pedestrian-3")).toBe(false);
    scheduler.release("junction-a", "pedestrian-1");

    expect(scheduler.request("junction-a", "pedestrian-3")).toBe(false);
    expect(scheduler.request("junction-a", "pedestrian-2")).toBe(true);
    scheduler.release("junction-a", "pedestrian-2");
    expect(scheduler.request("junction-a", "pedestrian-3")).toBe(true);
  });

  it("allows independent junctions and removes cancelled waiters", () => {
    const scheduler = new TownPedestrianJunctionScheduler();

    expect(scheduler.request("junction-a", "pedestrian-1")).toBe(true);
    expect(scheduler.request("junction-a", "pedestrian-2")).toBe(false);
    expect(scheduler.request("junction-b", "pedestrian-3")).toBe(true);
    scheduler.release("junction-a", "pedestrian-2");
    scheduler.release("junction-a", "pedestrian-1");

    expect(scheduler.request("junction-a", "pedestrian-3")).toBe(true);
  });

  it("keeps repeated frame requests idempotent and protects the current owner", () => {
    const scheduler = new TownPedestrianJunctionScheduler();

    expect(scheduler.request("junction-a", "pedestrian-1")).toBe(true);
    expect(scheduler.request("junction-a", "pedestrian-1")).toBe(true);
    expect(scheduler.request("junction-a", "pedestrian-2")).toBe(false);
    expect(scheduler.request("junction-a", "pedestrian-2")).toBe(false);

    scheduler.release("junction-a", "pedestrian-2");
    expect(scheduler.request("junction-a", "pedestrian-3")).toBe(false);
    scheduler.release("junction-a", "pedestrian-1");

    expect(scheduler.request("junction-a", "pedestrian-3")).toBe(true);
  });
});
