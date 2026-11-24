export type WalkPoint = readonly [number, number];
/** Four-way half-unit routing with sampled endpoint joins; never smooths across corners. */
export function findGridWalkPath(
  from: WalkPoint,
  to: WalkPoint,
  canWalk: (p: WalkPoint) => boolean,
  maxNodes = 5000,
): WalkPoint[] | null {
  const key = (p: WalkPoint) => `${p[0]},${p[1]}`;
  const clear = (a: WalkPoint, b: WalkPoint) => {
    const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.1));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!canWalk([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t])) return false;
    }
    return true;
  };
  if (![...from, ...to].every(Number.isFinite) || !canWalk(from) || !canWalk(to)) return null;
  // At a wall, the closest rounded grid cell can fall inside the obstacle.
  // Try the other corners of this cell only when the entire join is walkable.
  const snap = (p: WalkPoint) => {
    const candidates: WalkPoint[] = [];
    for (const x of new Set([Math.floor(p[0] * 2) / 2, Math.ceil(p[0] * 2) / 2]))
      for (const z of new Set([Math.floor(p[1] * 2) / 2, Math.ceil(p[1] * 2) / 2]))
        candidates.push([x, z]);
    const distance = ([x, z]: WalkPoint) => Math.hypot(x - p[0], z - p[1]);
    return candidates.sort((a, b) => distance(a) - distance(b)).find((c) => clear(p, c));
  };
  const start = snap(from),
    end = snap(to);
  if (!start || !end) return null;
  const queue: WalkPoint[] = [start],
    parents = new Map<string, WalkPoint | null>([[key(start), null]]);
  for (let i = 0; i < queue.length && i < maxNodes; i++) {
    const p = queue[i]!;
    if (key(p) === key(end)) {
      const path: WalkPoint[] = [];
      for (let at: WalkPoint | null = p; at; at = parents.get(key(at)) ?? null) path.push(at);
      return [from, ...path.reverse(), to];
    }
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ] as const) {
      const next: WalkPoint = [p[0] + dx, p[1] + dz];
      if (parents.has(key(next)) || !clear(p, next)) continue;
      parents.set(key(next), p);
      queue.push(next);
    }
  }
  return null;
}
