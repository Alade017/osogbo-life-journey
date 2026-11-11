import { describe, expect, it } from "vitest";
import { isValidTownMobilityLoop, townPedestrianClearanceRadius, isValidTownPedestrianRoute, measureTownMobilityLoop, deriveTownMobilityRoutes, deriveTownPedestrianCornerRoutes, deriveTownPedestrianCrossingRoutes, deriveTownPedestrianRoutes, deriveTownSidewalkCells, stitchTownPedestrianRoutes, TownPedestrianJunctionScheduler, TownTrafficJunctionScheduler, townMobilityRouteIdentity, townRoadJunctionIdentity, townPedestrianCrossingIdentity, TownRoadCrossingPriorityScheduler } from "@/game/town-mobility";
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
    expect(isValidTownPedestrianRoute([[0, 0], [0, 0], [1, 0]])).toBe(false);
    expect(isValidTownPedestrianRoute([[0, 0], [1, 0], [1, 0], [2, 0]])).toBe(false);
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

    expect(routes.every((route) => route.length === 4)).toBe(true);
    expect(routes.every((route) => isValidTownMobilityLoop(route))).toBe(true);
    const keys = routes.map((route) => route.map(([x, z]) => `${x.toFixed(3)},${z.toFixed(3)}`).join("|"));
    expect(new Set(keys).size).toBe(routes.length);
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

  it("finds only unique, geometrically valid outer corners in the authored town grid", () => {
    const routes = deriveTownPedestrianCornerRoutes(town.grid.rows, town.grid.cellSize);
    const keys = routes.map((route) => route.map(([x, z]) => `${x.toFixed(3)},${z.toFixed(3)}`).join("|"));
    expect(routes.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(routes.length);
    expect(routes.every((route) => route.length === 3 && isValidTownPedestrianRoute(route))).toBe(true);
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
        const offset = expectedOffset / town.grid.cellSize;
        const candidates = [
          { roadX: Math.round(gridX - offset), roadZ: Math.round(gridZ), sideX: 1, sideZ: 0, dx: gridX - Math.round(gridX - offset), dz: gridZ - Math.round(gridZ) },
          { roadX: Math.round(gridX + offset), roadZ: Math.round(gridZ), sideX: -1, sideZ: 0, dx: gridX - Math.round(gridX + offset), dz: gridZ - Math.round(gridZ) },
          { roadX: Math.round(gridX), roadZ: Math.round(gridZ - offset), sideX: 0, sideZ: 1, dx: gridX - Math.round(gridX), dz: gridZ - Math.round(gridZ - offset) },
          { roadX: Math.round(gridX), roadZ: Math.round(gridZ + offset), sideX: 0, sideZ: -1, dx: gridX - Math.round(gridX), dz: gridZ - Math.round(gridZ + offset) },
        ];
        const matching = candidates.find(({ roadX, roadZ, sideX, sideZ, dx, dz }) =>
          town.grid.rows[roadZ]?.[roadX] === "r"
          && town.grid.rows[roadZ + sideZ]?.[roadX + sideX] === "g"
          && !blocked.has(`${roadX + sideX},${roadZ + sideZ}`)
          && Math.max(Math.abs(dx), Math.abs(dz)) === offset
          && Math.min(Math.abs(dx), Math.abs(dz)) === 0
        );
        expect(matching).toBeDefined();
      }
    }
  });


  it("preserves authored-town pedestrian route coverage before prop reservations", () => {
    const routes = deriveTownPedestrianRoutes(town.grid.rows, town.grid.cellSize, blockedCells);
    const waypointCount = routes.reduce((total, route) => total + route.length, 0);
    const routeLengths = routes.map((route) => route.length);

    // Baseline for the authored grid, before roadside prop clearance is applied in R3FTownSurface.
    expect(routes.length).toBeGreaterThan(0);
    expect(waypointCount).toBeGreaterThanOrEqual(routes.length * 3);
    expect(Math.min(...routeLengths)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...routeLengths)).toBeLessThanOrEqual(town.grid.rows.length);
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


describe("stable traffic route identities", () => {
  it("keeps a route identity when unrelated routes are inserted before it", () => {
    const first = [[0, 0], [4, 0], [4, 3], [0, 3]] as const;
    const added = [[10, 0], [14, 0], [14, 3], [10, 3]] as const;
    expect(townMobilityRouteIdentity(first)).toBe(townMobilityRouteIdentity(first));
    expect([added, first].map(townMobilityRouteIdentity)[1]).toBe(townMobilityRouteIdentity(first));
  });

  it("rejects invalid loops rather than assigning an unstable identity", () => {
    expect(townMobilityRouteIdentity([[0, 0], [1, 0]])).toBe("");
    expect(townMobilityRouteIdentity([[0, 0], [Number.NaN, 1], [1, 1]])).toBe("");
  });

  it("distinguishes different route geometry", () => {
    expect(townMobilityRouteIdentity([[0, 0], [4, 0], [4, 3], [0, 3]]))
      .not.toBe(townMobilityRouteIdentity([[0, 0], [5, 0], [5, 3], [0, 3]]));
  });
});


describe("ambient traffic junction reservations", () => {
  it("grants one vehicle clearance and queues competing vehicles deterministically", () => {
    const scheduler = new TownTrafficJunctionScheduler();
    expect(scheduler.request("junction-1", "vehicle-b")).toBe(true);
    expect(scheduler.request("junction-1", "vehicle-a")).toBe(false);
    expect(scheduler.request("junction-1", "vehicle-c")).toBe(false);
    expect(scheduler.request("junction-1", "vehicle-b")).toBe(true);
    scheduler.release("junction-1", "vehicle-b");
    expect(scheduler.request("junction-1", "vehicle-a")).toBe(true);
    expect(scheduler.request("junction-1", "vehicle-c")).toBe(false);
  });

  it("allows independent junctions and removes vehicles that leave the simulation", () => {
    const scheduler = new TownTrafficJunctionScheduler();
    expect(scheduler.request("junction-1", "vehicle-a")).toBe(true);
    expect(scheduler.request("junction-1", "vehicle-b")).toBe(false);
    expect(scheduler.request("junction-2", "vehicle-c")).toBe(true);
    scheduler.cancelVehicle("vehicle-a");
    expect(scheduler.request("junction-1", "vehicle-b")).toBe(true);
    scheduler.cancelVehicle("vehicle-b");
    expect(scheduler.request("junction-1", "vehicle-c")).toBe(true);
  });

  it("rejects empty identifiers and makes release/cancellation idempotent", () => {
    const scheduler = new TownTrafficJunctionScheduler();
    expect(scheduler.request("", "vehicle-a")).toBe(false);
    expect(scheduler.request("junction-1", "")).toBe(false);
    scheduler.release("junction-1", "vehicle-a");
    scheduler.cancelVehicle("vehicle-a");
    expect(scheduler.request("junction-1", "vehicle-b")).toBe(true);
  });
});


describe("pedestrian junction reservation lifecycle", () => {
  it("keeps one pedestrian in a junction and serves waiting pedestrians in order", () => {
    const scheduler = new TownPedestrianJunctionScheduler();
    expect(scheduler.request("crossing-a", "ped-1")).toBe(true);
    expect(scheduler.request("crossing-a", "ped-2")).toBe(false);
    expect(scheduler.request("crossing-a", "ped-3")).toBe(false);
    expect(scheduler.request("crossing-a", "ped-2")).toBe(false);
    scheduler.release("crossing-a", "ped-1");
    expect(scheduler.request("crossing-a", "ped-2")).toBe(true);
    expect(scheduler.request("crossing-a", "ped-3")).toBe(false);
  });

  it("cancels an active or waiting pedestrian without blocking the crossing", () => {
    const scheduler = new TownPedestrianJunctionScheduler();
    expect(scheduler.request("crossing-a", "ped-1")).toBe(true);
    expect(scheduler.request("crossing-a", "ped-2")).toBe(false);
    scheduler.cancelPedestrian("ped-1");
    expect(scheduler.request("crossing-a", "ped-2")).toBe(true);
    scheduler.cancelPedestrian("ped-2");
    expect(scheduler.request("crossing-a", "ped-3")).toBe(true);
  });

  it("ignores empty IDs and repeated cleanup safely", () => {
    const scheduler = new TownPedestrianJunctionScheduler();
    expect(scheduler.request("", "ped-1")).toBe(false);
    expect(scheduler.request("crossing-a", "")).toBe(false);
    scheduler.release("", "ped-1");
    scheduler.cancelPedestrian("");
    scheduler.cancelPedestrian("ped-1");
    expect(scheduler.request("crossing-a", "ped-2")).toBe(true);
  });
});


describe("pedestrian routes through rendered zebra crossings", () => {
  it("connects opposite clear sidewalks at a four-way road intersection", () => {
    const routes = deriveTownPedestrianCrossingRoutes([".g.", "rrr", ".g."], 2);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual([[0, -1.28], [0, 0], [0, 1.28]]);
  });

  it("does not create a crossing when either sidewalk landing is blocked", () => {
    expect(deriveTownPedestrianCrossingRoutes([".g.", "rrr", ".g."], 2, [[1, 0]])).toHaveLength(0);
    expect(deriveTownPedestrianCrossingRoutes([".g.", "rrr", ".g."], 2, [[1, 2]])).toHaveLength(0);
  });

  it("ignores non-intersections, missing sidewalks and invalid dimensions", () => {
    expect(deriveTownPedestrianCrossingRoutes([".g.", ".r.", ".g."], 2)).toHaveLength(0);
    expect(deriveTownPedestrianCrossingRoutes(["...", "rrr", "..."], 2)).toHaveLength(0);
    expect(deriveTownPedestrianCrossingRoutes([".g.", "rrr", ".g."], 0)).toHaveLength(0);
  });
});


describe("shared pedestrian and vehicle crossing priority", () => {
  it("gives waiting pedestrians priority over vehicles when a junction clears", () => {
    const scheduler = new TownRoadCrossingPriorityScheduler();
    expect(scheduler.request("road-junction:4,8", "vehicle-1", "vehicle")).toBe(true);
    expect(scheduler.request("road-junction:4,8", "vehicle-2", "vehicle")).toBe(false);
    expect(scheduler.request("road-junction:4,8", "pedestrian-1", "pedestrian")).toBe(false);
    scheduler.release("road-junction:4,8", "vehicle-1");
    expect(scheduler.request("road-junction:4,8", "pedestrian-1", "pedestrian")).toBe(true);
    expect(scheduler.request("road-junction:4,8", "vehicle-2", "vehicle")).toBe(false);
  });

  it("keeps an active actor safe, isolates crossings and cleans up removed actors", () => {
    const scheduler = new TownRoadCrossingPriorityScheduler();
    expect(scheduler.request("crossing-a", "vehicle-1", "vehicle")).toBe(true);
    expect(scheduler.request("crossing-b", "pedestrian-1", "pedestrian")).toBe(true);
    expect(scheduler.request("crossing-a", "pedestrian-1", "pedestrian")).toBe(false);
    scheduler.cancelActor("vehicle-1");
    expect(scheduler.request("crossing-a", "pedestrian-1", "pedestrian")).toBe(true);
  });

  it("maps offset traffic lanes to the same centre-line junction as crossing signals", () => {
    expect(townRoadJunctionIdentity(11.44, -8.44)).toBe(townRoadJunctionIdentity(11, -8));
    expect(townRoadJunctionIdentity(10.56, -7.56)).toBe(townRoadJunctionIdentity(11, -8));
  });

  it("drives signal state from active and waiting pedestrian crossing priority", () => {
    const scheduler = new TownRoadCrossingPriorityScheduler();
    expect(scheduler.getSignalState("crossing-a")).toBe("go");
    expect(scheduler.request("crossing-a", "vehicle-1", "vehicle")).toBe(true);
    expect(scheduler.getSignalState("crossing-a")).toBe("go");
    expect(scheduler.request("crossing-a", "pedestrian-1", "pedestrian")).toBe(false);
    expect(scheduler.getSignalState("crossing-a")).toBe("caution");
    scheduler.release("crossing-a", "vehicle-1");
    expect(scheduler.getSignalState("crossing-a")).toBe("stop");
    expect(scheduler.request("crossing-a", "pedestrian-1", "pedestrian")).toBe(true);
    scheduler.release("crossing-a", "pedestrian-1");
    expect(scheduler.getSignalState("crossing-a")).toBe("go");
  });

  it("preserves arrival order for pedestrians while prioritising them over vehicles", () => {
    const scheduler = new TownRoadCrossingPriorityScheduler();
    expect(scheduler.request("crossing-a", "vehicle-owner", "vehicle")).toBe(true);
    expect(scheduler.request("crossing-a", "vehicle-waiter", "vehicle")).toBe(false);
    expect(scheduler.request("crossing-a", "pedestrian-z", "pedestrian")).toBe(false);
    expect(scheduler.request("crossing-a", "pedestrian-a", "pedestrian")).toBe(false);
    scheduler.release("crossing-a", "vehicle-owner");
    expect(scheduler.request("crossing-a", "pedestrian-z", "pedestrian")).toBe(true);
    scheduler.release("crossing-a", "pedestrian-z");
    expect(scheduler.request("crossing-a", "pedestrian-a", "pedestrian")).toBe(true);
  });

  it("identifies only straight symmetric three-point zebra-crossing routes", () => {
    const crossing = [[0, -1.28], [0, 0], [0, 1.28]] as const;
    expect(townPedestrianCrossingIdentity(crossing)).toBe(townRoadJunctionIdentity(0, 0));
    expect(townPedestrianCrossingIdentity([[0, 0], [1, 0], [1, 1]])).toBe("");
    expect(townRoadJunctionIdentity(Number.NaN, 0)).toBe("");
  });
  it("advances through a deterministic timed signal cycle without moving backwards", () => {
    const scheduler = new TownRoadCrossingPriorityScheduler();
    scheduler.setSignalizedJunctions(["road-junction:4,8"]);
    scheduler.advanceTime(0);
    const phases = new Set<string>();
    for (let second = 0; second <= 48; second += 1) {
      scheduler.advanceTime(second);
      const phase = scheduler.getSignalPhase("road-junction:4,8");
      phases.add(phase);
      const expectedSignal = phase === "vehicle-green" ? "go" : phase === "amber" ? "caution" : "stop";
      expect(scheduler.getSignalState("road-junction:4,8")).toBe(expectedSignal);
    }
    const phaseAtFortyEight = scheduler.getSignalPhase("road-junction:4,8");
    scheduler.advanceTime(12);
    expect(scheduler.getSignalPhase("road-junction:4,8")).toBe(phaseAtFortyEight);
    expect(phases).toEqual(new Set([
      "vehicle-green", "amber", "all-red", "pedestrian-walk", "clearance",
    ]));
  });

  it("does not impose timed lights on unsignalized junctions", () => {
    const scheduler = new TownRoadCrossingPriorityScheduler();
    scheduler.setSignalizedJunctions(["signalized-junction"]);
    scheduler.advanceTime(8);
    expect(scheduler.request("unsignalized-junction", "vehicle-1", "vehicle")).toBe(true);
    expect(scheduler.getSignalState("unsignalized-junction")).toBe("go");
  });

  it("allows vehicles and pedestrians to reserve only during their respective green phases", () => {
    const junction = "road-junction:4,8";
    const vehicleScheduler = new TownRoadCrossingPriorityScheduler();
    vehicleScheduler.setSignalizedJunctions([junction]);
    vehicleScheduler.advanceTime(0);
    let vehicleGranted = false;
    for (let second = 0; second <= 48 && !vehicleGranted; second += 1) {
      vehicleScheduler.advanceTime(second);
      if (vehicleScheduler.getSignalPhase(junction) === "vehicle-green") {
        vehicleGranted = vehicleScheduler.request(junction, "vehicle-1", "vehicle");
      }
    }
    expect(vehicleGranted).toBe(true);

    const pedestrianScheduler = new TownRoadCrossingPriorityScheduler();
    pedestrianScheduler.setSignalizedJunctions([junction]);
    pedestrianScheduler.advanceTime(0);
    let pedestrianGranted = false;
    for (let second = 0; second <= 48 && !pedestrianGranted; second += 1) {
      pedestrianScheduler.advanceTime(second);
      if (pedestrianScheduler.getSignalPhase(junction) === "pedestrian-walk") {
        pedestrianGranted = pedestrianScheduler.request(junction, "pedestrian-1", "pedestrian");
      }
    }
    expect(pedestrianGranted).toBe(true);
  });
});
