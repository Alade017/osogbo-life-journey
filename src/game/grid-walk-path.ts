export type WalkPoint = readonly [number, number];
/** Four-way half-unit routing with sampled endpoint joins; never smooths across corners. */
export function findGridWalkPath(
  from: WalkPoint,
  to: WalkPoint,
  canWalk: (p: WalkPoint) => boolean,
  maxNodes = 5000,
): WalkPoint[] | null {
  const snap = (p: WalkPoint): WalkPoint => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2];
  const start = snap(from),
    end = snap(to),
    key = (p: WalkPoint) => `${p[0]},${p[1]}`;
  const clear = (a: WalkPoint, b: WalkPoint) => {
    const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.1));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!canWalk([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t])) return false;
    }
    return true;
  };
  if (![...from, ...to].every(Number.isFinite) || !clear(from, start) || !clear(end, to))
    return null;
  const queue: WalkPoint[] = [start],
    parents = new Map<string, WalkPoint | null>([[key(start), null]]);
  for (let i = 0; i < queue.length && i < maxNodes; i++) {
    const p = queue[i];
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
    ]) {
      const next: WalkPoint = [p[0] + dx, p[1] + dz];
      if (parents.has(key(next)) || !clear(p, next)) continue;
      parents.set(key(next), p);
      queue.push(next);
    }
  }
  return null;
}
