export type TownMobilityRoute = readonly [number, number][];

/** Returns unique grass cells directly beside a road, where sidewalks are rendered. */
export function deriveTownSidewalkCells(rows: readonly string[]): [number, number][] {
  const cells = new Map<string, [number, number]>();
  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "r") return;
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const sidewalkX = x + dx;
        const sidewalkZ = z + dz;
        if (rows[sidewalkZ]?.[sidewalkX] !== "g") continue;
        cells.set(`${sidewalkX},${sidewalkZ}`, [sidewalkX, sidewalkZ]);
      }
    });
  });
  return [...cells.values()];
}

/**
 * Builds closed mobility loops from the town's road-cell data.
 * A route is emitted only when all four sides of its rectangle are roads.
 */
export function deriveTownMobilityRoutes(
  rows: readonly string[],
  cellSize: number,
  laneOffset = 0,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(laneOffset)) return [];
  const rowCount = rows.length;
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const isRoad = (x: number, z: number) => rows[z]?.[x] === "r";
  const toWorld = (x: number, z: number): [number, number] => [
    (x - (columnCount - 1) / 2) * cellSize,
    (z - (rowCount - 1) / 2) * cellSize,
  ];
  const routes: TownMobilityRoute[] = [];

  // Find closed rectangles from contiguous road edges, rather than requiring
  // an avenue to span the entire map or a road to span every map row.
  for (let top = 0; top < rowCount - 2; top += 1) {
    for (let bottom = top + 2; bottom < rowCount; bottom += 1) {
      for (let left = 0; left < columnCount - 2; left += 1) {
        for (let right = left + 2; right < columnCount; right += 1) {
          const perimeterIsRoad = (
            Array.from({ length: right - left + 1 }, (_, i) => left + i)
              .every((x) => isRoad(x, top) && isRoad(x, bottom))
            && Array.from({ length: bottom - top + 1 }, (_, i) => top + i)
              .every((z) => isRoad(left, z) && isRoad(right, z))
          );
          if (!perimeterIsRoad) continue;

          // Keep only adjacent road-grid blocks: an uninterrupted internal
          // road edge means this rectangle should be represented by its
          // smaller neighbouring blocks instead.
          const splitHorizontally = Array.from({ length: bottom - top - 1 }, (_, i) => top + i + 1)
            .some((z) => Array.from({ length: right - left + 1 }, (_, i) => left + i).every((x) => isRoad(x, z)));
          if (splitHorizontally) continue;
          const splitVertically = Array.from({ length: right - left - 1 }, (_, i) => left + i + 1)
            .some((x) => Array.from({ length: bottom - top + 1 }, (_, i) => top + i).every((z) => isRoad(x, z)));
          if (splitVertically) continue;

          const inset = laneOffset / cellSize;
          routes.push([
            toWorld(left + inset, top + inset),
            toWorld(right - inset, top + inset),
            toWorld(right - inset, bottom - inset),
            toWorld(left + inset, bottom - inset),
          ]);
        }
      }
    }
  }
  return routes;
}

/**
 * Derives open pedestrian routes from walkable sidewalk cells beside roads.
 * Building footprints, plots and water are excluded so walkers stay on paths
 * that the town layout actually provides.
 */
export function deriveTownPedestrianRoutes(
  rows: readonly string[],
  cellSize: number,
  blockedCells: readonly (readonly [number, number])[],
  sidewalkWidth = cellSize * 0.28,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(sidewalkWidth) || sidewalkWidth < 0) return [];
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));
  const lines = new Map<string, { coordinates: Set<number>; orientation: "h" | "v"; fixed: number; side: number }>();
  const sidewalkOffset = cellSize / 2 + sidewalkWidth / 2;

  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "r") return;
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const sidewalkX = x + dx;
        const sidewalkZ = z + dz;
        if (rows[sidewalkZ]?.[sidewalkX] !== "g") continue;
        if (blocked.has(`${sidewalkX},${sidewalkZ}`)) continue;

        // Keep each side of a road as its own line. Waypoints sit at the
        // centre of the rendered sidewalk strip, not at the grass-cell centre.
        const orientation = dx === 0 ? "h" : "v";
        const side = dx === 0 ? dz : dx;
        const fixed = orientation === "h" ? sidewalkZ : sidewalkX;
        const coordinate = orientation === "h" ? x : z;
        const key = `${orientation}:${fixed}:${side}`;
        const line = lines.get(key) ?? { coordinates: new Set<number>(), orientation, fixed, side };
        line.coordinates.add(coordinate);
        lines.set(key, line);
      }
    });
  });

  const routes: TownMobilityRoute[] = [];
  for (const { coordinates: values, orientation, fixed, side } of lines.values()) {
    const coordinates = [...values].sort((a, b) => a - b);
    let run: number[] = [];

    const appendRun = () => {
      if (run.length >= 3) {
        const points: [number, number][] = run.map((coordinate) => {
          const roadX = orientation === "h" ? coordinate : fixed - side;
          const roadZ = orientation === "h" ? fixed - side : coordinate;
          const x = (roadX - (columnCount - 1) / 2) * cellSize;
          const z = (roadZ - (rows.length - 1) / 2) * cellSize;
          return orientation === "h"
            ? [x, z + side * sidewalkOffset]
            : [x + side * sidewalkOffset, z];
        });
        routes.push(points);
      }
      run = [];
    };

    for (const coordinate of coordinates) {
      if (run.length > 0 && coordinate !== run[run.length - 1]! + 1) appendRun();
      run.push(coordinate);
    }
    appendRun();
  }

  return routes;
}


/**
 * Connects opposite sidewalk edges through rendered zebra crossings at road
 * intersections. The route is emitted only when both sidewalk landing cells
 * exist and are not occupied by buildings, plots, water or reserved props.
 */
export function deriveTownPedestrianCrossingRoutes(
  rows: readonly string[],
  cellSize: number,
  blockedCells: readonly (readonly [number, number])[] = [],
  sidewalkWidth = cellSize * 0.28,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0
    || !Number.isFinite(sidewalkWidth) || sidewalkWidth < 0) return [];
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));
  const offset = cellSize / 2 + sidewalkWidth / 2;
  const routes: TownMobilityRoute[] = [];

  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "r") return;
      const horizontal = row[x - 1] === "r" || row[x + 1] === "r";
      if (!horizontal) return;

      // Match the currently rendered zebra-stripe orientation: cross the
      // north/south sidewalk pair where the intersection has a horizontal arm.
      const north = [x, z - 1] as const;
      const south = [x, z + 1] as const;
      if (rows[north[1]]?.[north[0]] !== "g" || rows[south[1]]?.[south[0]] !== "g") return;
      if ([north, south].some(([cellX, cellZ]) => blocked.has(`${cellX},${cellZ}`))) return;

      const centerX = (x - (columnCount - 1) / 2) * cellSize;
      const centerZ = (z - (rows.length - 1) / 2) * cellSize;
      routes.push([
        [centerX, centerZ - offset],
        [centerX, centerZ],
        [centerX, centerZ + offset],
      ]);
    });
  });

  return routes;
}

/**
 * Builds L-shaped pedestrian paths through rendered outer sidewalk-corner tiles.
 * Each diagonal grass patch can connect its two adjoining road-sidewalk strips.
 */
export function deriveTownPedestrianCornerRoutes(
  rows: readonly string[],
  cellSize: number,
  blockedCells: readonly (readonly [number, number])[] = [],
  sidewalkWidth = cellSize * 0.28,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(sidewalkWidth) || sidewalkWidth < 0) return [];
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));
  const offset = cellSize / 2 - sidewalkWidth / 2;
  const toWorld = (x: number, z: number): [number, number] => [
    (x - (columnCount - 1) / 2) * cellSize,
    (z - (rows.length - 1) / 2) * cellSize,
  ];
  const routes: TownMobilityRoute[] = [];

  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "g" || blocked.has(`${x},${z}`)) return;
      for (const dz of [-1, 1] as const) {
        for (const dx of [-1, 1] as const) {
          const horizontalRoad = [x + dx, z] as const;
          const verticalRoad = [x, z + dz] as const;
          if (rows[horizontalRoad[1]]?.[horizontalRoad[0]] !== "r") continue;
          if (rows[verticalRoad[1]]?.[verticalRoad[0]] !== "r") continue;
          if ([horizontalRoad, verticalRoad].some(([cellX, cellZ]) => blocked.has(`${cellX},${cellZ}`))) continue;

          const horizontal = toWorld(horizontalRoad[0], horizontalRoad[1]);
          const vertical = toWorld(verticalRoad[0], verticalRoad[1]);
          const corner = toWorld(x, z);
          routes.push([
            [horizontal[0], horizontal[1] + dz * offset],
            [corner[0] + dx * offset, corner[1] + dz * offset],
            [vertical[0] + dx * offset, vertical[1]],
          ]);
        }
      }
    });
  });

  return routes;
}

/**
 * Joins straight sidewalk runs and corner connectors at shared endpoints.
 * Every input segment is retained exactly once; branches become separate
 * pedestrian trails rather than forcing walkers through a road or prop.
 */
export function stitchTownPedestrianRoutes(
  routes: readonly TownMobilityRoute[],
): TownMobilityRoute[] {
  type Point = readonly [number, number];
  type Edge = { id: number; a: Point; b: Point };
  const keyOf = ([x, z]: Point) => `${x.toFixed(5)},${z.toFixed(5)}`;
  const points = new Map<string, Point>();
  const adjacency = new Map<string, Edge[]>();
  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();

  routes.forEach((route) => {
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1]!;
      const b = route[index]!;
      // Invalid authored or generated coordinates must never enter the graph:
      // a single NaN/Infinity waypoint would otherwise poison the NPC transform.
      if (![a[0], a[1], b[0], b[1]].every(Number.isFinite)) continue;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.001) continue;
      const aKey = keyOf(a);
      const bKey = keyOf(b);
      const edgeKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      if (edgeKeys.has(edgeKey)) continue;
      edgeKeys.add(edgeKey);
      const edge = { id: edges.length, a, b };
      edges.push(edge);
      points.set(aKey, a);
      points.set(bKey, b);
      adjacency.set(aKey, [...(adjacency.get(aKey) ?? []), edge]);
      adjacency.set(bKey, [...(adjacency.get(bKey) ?? []), edge]);
    }
  });

  const used = new Set<number>();
  const trails: TownMobilityRoute[] = [];
  const walk = (startKey: string, firstEdge: Edge) => {
    const path: Point[] = [points.get(startKey)!];
    let currentKey = startKey;
    let edge: Edge | undefined = firstEdge;
    while (edge && !used.has(edge.id)) {
      used.add(edge.id);
      const currentPoint = points.get(currentKey)!;
      const nextPoint = keyOf(edge.a) === currentKey ? edge.b : edge.a;
      const nextKey = keyOf(nextPoint);
      path.push(nextPoint);
      currentKey = nextKey;
      if ((adjacency.get(currentKey)?.length ?? 0) !== 2) break;
      edge = adjacency.get(currentKey)?.find((candidate) => !used.has(candidate.id));
    }
    if (path.length >= 2) trails.push(path);
  };

  // Start at endpoints and junctions first, so branch points split into safe trails.
  for (const [key, connected] of adjacency) {
    if (connected.length === 2) continue;
    for (const edge of connected) if (!used.has(edge.id)) walk(key, edge);
  }
  // Consume closed loops and any remaining degree-two components.
  for (const edge of edges) {
    if (used.has(edge.id)) continue;
    walk(keyOf(edge.a), edge);
  }
  return trails;
}

/**
 * Coordinates pedestrian access to shared trail endpoints. Requests are queued
 * in arrival order so only one pedestrian occupies a junction clearance zone.
 */
export class TownPedestrianJunctionScheduler {
  private readonly owners = new Map<string, string>();
  private readonly waiters = new Map<string, string[]>();

  request(junctionId: string, pedestrianId: string): boolean {
    if (!junctionId || !pedestrianId) return false;
    const owner = this.owners.get(junctionId);
    if (owner === pedestrianId) return true;
    const queue = this.waiters.get(junctionId) ?? [];
    if (!queue.includes(pedestrianId)) queue.push(pedestrianId);
    this.waiters.set(junctionId, queue);
    if (owner || queue[0] !== pedestrianId) return false;
    this.owners.set(junctionId, pedestrianId);
    queue.shift();
    if (queue.length === 0) this.waiters.delete(junctionId);
    return true;
  }

  release(junctionId: string, pedestrianId: string): void {
    if (!junctionId || !pedestrianId) return;
    if (this.owners.get(junctionId) === pedestrianId) this.owners.delete(junctionId);
    const queue = this.waiters.get(junctionId);
    if (!queue) return;
    const remaining = queue.filter((id) => id !== pedestrianId);
    if (remaining.length > 0) this.waiters.set(junctionId, remaining);
    else this.waiters.delete(junctionId);
  }

  cancelPedestrian(pedestrianId: string): void {
    if (!pedestrianId) return;
    for (const [junctionId, owner] of this.owners) {
      if (owner === pedestrianId) this.owners.delete(junctionId);
    }
    for (const [junctionId, queue] of this.waiters) {
      const remaining = queue.filter((id) => id !== pedestrianId);
      if (remaining.length > 0) this.waiters.set(junctionId, remaining);
      else this.waiters.delete(junctionId);
    }
  }
}


/**
 * Reserves shared road-junction clearance zones for ambient traffic simulation.
 * This is presentation-only coordination; it is not a multiplayer or travel authority.
 */
export class TownTrafficJunctionScheduler {
  private readonly owners = new Map<string, string>();
  private readonly waiters = new Map<string, string[]>();

  request(junctionId: string, vehicleId: string): boolean {
    if (!junctionId || !vehicleId) return false;
    if (this.owners.get(junctionId) === vehicleId) return true;
    const queue = this.waiters.get(junctionId) ?? [];
    if (!queue.includes(vehicleId)) {
      queue.push(vehicleId);
      queue.sort((a, b) => a.localeCompare(b));
    }
    this.waiters.set(junctionId, queue);
    if (this.owners.has(junctionId) || queue[0] !== vehicleId) return false;
    this.owners.set(junctionId, vehicleId);
    queue.shift();
    if (queue.length === 0) this.waiters.delete(junctionId);
    return true;
  }

  release(junctionId: string, vehicleId: string): void {
    if (this.owners.get(junctionId) === vehicleId) this.owners.delete(junctionId);
    const queue = this.waiters.get(junctionId);
    if (!queue) return;
    const remaining = queue.filter((id) => id !== vehicleId);
    if (remaining.length > 0) this.waiters.set(junctionId, remaining);
    else this.waiters.delete(junctionId);
  }

  cancelVehicle(vehicleId: string): void {
    for (const junctionId of this.owners.keys()) {
      if (this.owners.get(junctionId) === vehicleId) this.owners.delete(junctionId);
    }
    for (const [junctionId, queue] of this.waiters) {
      const remaining = queue.filter((id) => id !== vehicleId);
      if (remaining.length > 0) this.waiters.set(junctionId, remaining);
      else this.waiters.delete(junctionId);
    }
  }
}

/** Stable shared key for a road intersection expressed in world coordinates. */
export function townRoadJunctionIdentity(x: number, z: number): string {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return "";
  return `road-junction:${Math.round(x)},${Math.round(z)}`;
}

/** Identifies the centre of a straight, three-point route through a zebra crossing. */
export function townPedestrianCrossingIdentity(route: TownMobilityRoute): string {
  if (route.length !== 3 || !isValidTownPedestrianRoute(route)) return "";
  const [start, centre, end] = route;
  const first = [centre[0] - start[0], centre[1] - start[1]];
  const second = [end[0] - centre[0], end[1] - centre[1]];
  const cross = first[0] * second[1] - first[1] * second[0];
  const dot = first[0] * second[0] + first[1] * second[1];
  if (Math.abs(cross) > 0.001 || dot <= 0
    || Math.abs(Math.hypot(...first) - Math.hypot(...second)) > 0.001) return "";
  return townRoadJunctionIdentity(centre[0], centre[1]);
}

/**
 * Shared local right-of-way for ambient traffic and pedestrians.
 * Pedestrians receive priority when a junction becomes free; an actor already
 * inside the clearance zone is never pre-empted.
 */
export type TownTrafficSignalPhase =
  | "vehicle-green"
  | "amber"
  | "all-red"
  | "pedestrian-walk"
  | "clearance";

const TOWN_SIGNAL_PHASES: readonly { phase: TownTrafficSignalPhase; duration: number }[] = [
  { phase: "vehicle-green", duration: 12 },
  { phase: "amber", duration: 3 },
  { phase: "all-red", duration: 1 },
  { phase: "pedestrian-walk", duration: 7 },
  { phase: "clearance", duration: 1 },
];
const TOWN_SIGNAL_CYCLE_SECONDS = TOWN_SIGNAL_PHASES.reduce((total, phase) => total + phase.duration, 0);

/** Shared, deterministic signal timing and crossing reservations for the rendered town. */
export class TownRoadCrossingPriorityScheduler {
  private readonly owners = new Map<string, { id: string; kind: "pedestrian" | "vehicle" }>();
  private readonly waiters = new Map<string, Array<{ id: string; kind: "pedestrian" | "vehicle" }>>();
  private elapsedSeconds: number | null = null;
  private readonly signalizedJunctions = new Set<string>();

  setSignalizedJunctions(junctionIds: readonly string[]): void {
    this.signalizedJunctions.clear();
    junctionIds.forEach((id) => { if (id) this.signalizedJunctions.add(id); });
  }

  /** R3F actors may call this every frame; max() makes multi-caller updates idempotent. */
  advanceTime(elapsedSeconds: number): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return;
    this.elapsedSeconds = Math.max(this.elapsedSeconds ?? 0, elapsedSeconds);
  }

  private phaseOffset(junctionId: string): number {
    let hash = 2166136261;
    for (let index = 0; index < junctionId.length; index += 1) {
      hash ^= junctionId.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % TOWN_SIGNAL_CYCLE_SECONDS;
  }

  getSignalPhase(junctionId: string): TownTrafficSignalPhase {
    if (!junctionId || this.elapsedSeconds === null) return "vehicle-green";
    let cycleTime = (this.elapsedSeconds + this.phaseOffset(junctionId)) % TOWN_SIGNAL_CYCLE_SECONDS;
    for (const phase of TOWN_SIGNAL_PHASES) {
      if (cycleTime < phase.duration) return phase.phase;
      cycleTime -= phase.duration;
    }
    return "clearance";
  }

  request(junctionId: string, actorId: string, kind: "pedestrian" | "vehicle"): boolean {
    if (!junctionId || !actorId) return false;
    const owner = this.owners.get(junctionId);
    if (owner?.id === actorId) return true;
    const queue = this.waiters.get(junctionId) ?? [];
    if (!queue.some((item) => item.id === actorId)) {
      queue.push({ id: actorId, kind });
      // Stable sorting preserves arrival order within each priority class.
      queue.sort((a, b) => (a.kind === "pedestrian" ? 0 : 1) - (b.kind === "pedestrian" ? 0 : 1));
    }
    this.waiters.set(junctionId, queue);
    if (owner || queue[0]?.id !== actorId) return false;

    // Preserve the legacy scheduler behaviour in isolated tests/tools until a
    // live R3F clock is supplied. In the town scene, phase permissions gate entry.
    if (this.elapsedSeconds !== null && this.signalizedJunctions.has(junctionId)) {
      const phase = this.getSignalPhase(junctionId);
      if (kind === "vehicle" && phase !== "vehicle-green") return false;
      if (kind === "pedestrian" && phase !== "pedestrian-walk") return false;
    }

    this.owners.set(junctionId, { id: actorId, kind });
    queue.shift();
    if (queue.length === 0) this.waiters.delete(junctionId);
    return true;
  }

  release(junctionId: string, actorId: string): void {
    if (!junctionId || !actorId) return;
    if (this.owners.get(junctionId)?.id === actorId) this.owners.delete(junctionId);
    const queue = this.waiters.get(junctionId);
    if (!queue) return;
    const remaining = queue.filter((item) => item.id !== actorId);
    if (remaining.length) this.waiters.set(junctionId, remaining);
    else this.waiters.delete(junctionId);
  }

  getSignalState(junctionId: string): "stop" | "caution" | "go" {
    if (!junctionId) return "go";
    const owner = this.owners.get(junctionId);
    if (owner?.kind === "pedestrian") return "stop";
    const pedestrianWaiting = this.waiters.get(junctionId)?.some((actor) => actor.kind === "pedestrian") ?? false;
    if (this.elapsedSeconds !== null && this.signalizedJunctions.has(junctionId)) {
      const phase = this.getSignalPhase(junctionId);
      if (phase === "vehicle-green") return "go";
      if (phase === "amber") return "caution";
      return "stop";
    }
    if (pedestrianWaiting) return owner?.kind === "vehicle" ? "caution" : "stop";
    return "go";
  }

  cancelActor(actorId: string): void {
    if (!actorId) return;
    for (const [junctionId, owner] of this.owners) {
      if (owner.id === actorId) this.owners.delete(junctionId);
    }
    for (const [junctionId, queue] of this.waiters) {
      const remaining = queue.filter((item) => item.id !== actorId);
      if (remaining.length) this.waiters.set(junctionId, remaining);
      else this.waiters.delete(junctionId);
    }
  }
}

/** Stable identity for an authored traffic loop; independent of route array ordering. */
export function townMobilityRouteIdentity(route: TownMobilityRoute): string {
  if (!isValidTownMobilityLoop(route)) return "";
  const canonical = route.map(([x, z]) => `${x.toFixed(4)},${z.toFixed(4)}`).join("|");
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Measures traversable edges in a closed route, ignoring malformed and degenerate segments. */
export function measureTownMobilityLoop(route: TownMobilityRoute): number {
  if (route.length < 2) return 0;
  return route.reduce((total, point, index) => {
    const next = route[(index + 1) % route.length]!;
    if (![point[0], point[1], next[0], next[1]].every(Number.isFinite)) return total;
    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    return Number.isFinite(length) && length >= 0.001 ? total + length : total;
  }, 0);
}


/** Validates an open pedestrian trail before assigning it to an animated character. */
export function isValidTownPedestrianRoute(route: TownMobilityRoute): boolean {
  if (route.length < 2) return false;
  if (!route.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))) return false;

  let totalLength = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]!;
    const current = route[index]!;
    const segmentLength = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    if (!Number.isFinite(segmentLength) || segmentLength < 0.001) return false;
    totalLength += segmentLength;
  }

  return Number.isFinite(totalLength) && totalLength >= 0.001;
}


/** Scales junction clearance for short trails so both endpoints remain reachable. */
export function townPedestrianClearanceRadius(routeLength: number, preferredRadius = 0.38): number {
  if (!Number.isFinite(routeLength) || routeLength <= 0
    || !Number.isFinite(preferredRadius) || preferredRadius <= 0) return 0;
  return Math.min(preferredRadius, routeLength / 3);
}


/** Rejects traffic loops containing malformed points or no traversable perimeter. */
export function isValidTownMobilityLoop(route: TownMobilityRoute): boolean {
  if (route.length < 3 || !route.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))) {
    return false;
  }

  const uniquePoints = new Set(route.map(([x, z]) => `${x.toFixed(5)},${z.toFixed(5)}`));
  if (uniquePoints.size < 3) return false;

  let twiceArea = 0;
  for (let index = 0; index < route.length; index += 1) {
    const current = route[index]!;
    const next = route[(index + 1) % route.length]!;
    const edgeLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    if (!Number.isFinite(edgeLength) || edgeLength < 0.001) return false;
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }

  return Number.isFinite(twiceArea) && Math.abs(twiceArea) >= 0.002;
}
