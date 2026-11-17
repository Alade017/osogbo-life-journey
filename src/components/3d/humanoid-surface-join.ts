import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from "three";

export type SkinnedSurface = {
  geometry: BufferGeometry;
  ringHeights: readonly number[];
  segments: number;
};
type Vertex = { p: number[]; uv: number[]; bones: number[]; weights: number[] };

/** Join open anatomical boundaries with shared vertices and interpolated skin weights. */
export function connectBodySurfaces(
  torso: SkinnedSurface,
  arms: readonly SkinnedSurface[],
  legs: readonly SkinnedSurface[],
) {
  const vertices: Vertex[] = [],
    indices: number[] = [];
  function append(surface: SkinnedSurface, include: (offset: number) => boolean = () => true) {
    const start = vertices.length;
    const g = surface.geometry;
    const p = g.getAttribute("position"),
      uv = g.getAttribute("uv"),
      bones = g.getAttribute("skinIndex"),
      weights = g.getAttribute("skinWeight");
    for (let i = 0; i < p.count; i++)
      vertices.push({
        p: [p.getX(i), p.getY(i), p.getZ(i)],
        uv: [uv.getX(i), uv.getY(i)],
        bones: Array.from({ length: 4 }, (_, j) => bones.getComponent(i, j)),
        weights: Array.from({ length: 4 }, (_, j) => weights.getComponent(i, j)),
      });
    const source = g.getIndex()!;
    for (let i = 0; i < source.count; i += 3)
      if (include(i))
        indices.push(
          start + source.getX(i),
          start + source.getX(i + 1),
          start + source.getX(i + 2),
        );
    return start;
  }
  const n = torso.segments;
  const wrap = (i: number) => (i + n) % n;
  const first = torso.ringHeights.findIndex((y) => Math.abs(y - 0.73) < 0.00001);
  const last = torso.ringHeights.findIndex((y) => Math.abs(y - 0.85) < 0.00001);
  const width = arms[0]!.segments / 2 - (last - first);
  if (first < 0 || last <= first || width < 2)
    throw new Error("Invalid shoulder surface boundaries");
  const sockets = [0, n / 2].map((center) => ({ start: center - Math.floor(width / 2), width }));
  const sideCount = (torso.ringHeights.length - 1) * n * 6;
  append(torso, (offset) => {
    if (offset >= sideCount) return (offset - sideCount) % 6 !== 0; // Remove the pelvis cap, keep the neckline.
    const row = Math.floor(offset / (n * 6)),
      column = Math.floor(offset / 6) % n;
    return !sockets.some(
      (socket) =>
        row >= first &&
        row < last &&
        Array.from({ length: width }, (_, i) => wrap(socket.start + i)).includes(column),
    );
  });
  const armStarts = arms.map((surface) => append(surface));
  const legStarts = legs.map((surface) => append(surface));
  function mix(a: Vertex, b: Vertex, t: number, lift: number): Vertex {
    const weights = new Map<number, number>();
    for (const [v, influence] of [
      [a, 1 - t],
      [b, t],
    ] as const)
      v.bones.forEach((bone, i) => {
        const weight = v.weights[i]! * influence;
        if (weight > 0) weights.set(bone, (weights.get(bone) ?? 0) + weight);
      });
    const sorted = [...weights].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const total = sorted.reduce((sum, [, w]) => sum + w, 0);
    return {
      p: a.p.map((v, i) => v + (b.p[i]! - v) * t + (i === 1 ? Math.sin(t * Math.PI) * lift : 0)),
      uv: a.uv.map((v, i) => v + (b.uv[i]! - v) * t),
      bones: Array.from({ length: 4 }, (_, i) => sorted[i]?.[0] ?? 0),
      weights: Array.from({ length: 4 }, (_, i) => (sorted[i]?.[1] ?? 0) / total),
    };
  }
  function bridge(
    source: number[],
    target: number[],
    lift = 0,
    leg?: { surface: SkinnedSurface; start: number },
  ) {
    if (source.length !== target.length)
      throw new Error("Joint loops must have matching vertex counts");
    const count = source.length;
    // Reversed boundary directions preserve outward face winding. Only rotate to find the closest correspondence.
    let best: number[] = [],
      distance = Infinity;
    for (let shift = 0; shift < count; shift++) {
      const candidate = target.map((_, i) => target[(shift - i + count) % count]!);
      const cost = source.reduce(
        (sum, id, i) =>
          sum +
          new Vector3(...(vertices[id]!.p as [number, number, number])).distanceToSquared(
            new Vector3(...(vertices[candidate[i]!]!.p as [number, number, number])),
          ),
        0,
      );
      if (cost < distance) {
        distance = cost;
        best = candidate;
      }
    }
    if (leg) {
      // Match the thigh's angular spacing to the hip opening. Uniform circles otherwise bunch
      // vertices along the crotch and fold the connector into a visible horizontal ledge.
      const topRow = leg.surface.ringHeights.length - 1;
      const top = best.map((id) => vertices[id]!.p);
      const cx = (Math.min(...top.map((p) => p[0]!)) + Math.max(...top.map((p) => p[0]!))) / 2;
      const cz = (Math.min(...top.map((p) => p[2]!)) + Math.max(...top.map((p) => p[2]!))) / 2;
      const rx = Math.max(...top.map((p) => p[0]!)) - cx;
      const rz = Math.max(...top.map((p) => p[2]!)) - cz;
      const angles = source.map((id) =>
        Math.atan2((vertices[id]!.p[2]! - cz) / rz, (vertices[id]!.p[0]! - cx) / rx),
      );
      for (let row = topRow - 1; row <= topRow; row++) {
        const ringStart = leg.start + row * leg.surface.segments;
        const ring = Array.from(
          { length: leg.surface.segments },
          (_, i) => vertices[ringStart + i]!.p,
        );
        const x = (Math.min(...ring.map((p) => p[0]!)) + Math.max(...ring.map((p) => p[0]!))) / 2;
        const z = (Math.min(...ring.map((p) => p[2]!)) + Math.max(...ring.map((p) => p[2]!))) / 2;
        const width = Math.max(...ring.map((p) => p[0]!)) - x;
        const depth = Math.max(...ring.map((p) => p[2]!)) - z;
        best.forEach((id, i) => {
          const column = (id - leg.start) % leg.surface.segments;
          const vertex = vertices[ringStart + column]!;
          const original = Math.atan2((vertex.p[2]! - z) / depth, (vertex.p[0]! - x) / width);
          const difference = Math.atan2(
            Math.sin(angles[i]! - original),
            Math.cos(angles[i]! - original),
          );
          const angle = original + difference * (row === topRow ? 1 : 0.5);
          vertex.p[0] = x + Math.cos(angle) * width;
          vertex.p[2] = z + Math.sin(angle) * depth;
          if (row === topRow)
            vertex.p[1] = Math.min(vertex.p[1]!, vertices[source[i]!]!.p[1]! - 0.025);
        });
      }
    }
    let previous = source;
    for (let step = 1; step <= 3; step++) {
      const next =
        step === 3
          ? best
          : source.map((id, i) => {
              const index = vertices.length;
              vertices.push(mix(vertices[id]!, vertices[best[i]!]!, step / 3, lift));
              return index;
            });
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count;
        indices.push(previous[i]!, next[i]!, previous[j]!, previous[j]!, next[i]!, next[j]!);
      }
      previous = next;
    }
  }
  sockets.forEach((socket, side) => {
    const loop: number[] = [];
    for (let i = 0; i <= width; i++) loop.push(first * n + wrap(socket.start + i));
    for (let row = first + 1; row <= last; row++) loop.push(row * n + wrap(socket.start + width));
    for (let i = width - 1; i >= 0; i--) loop.push(last * n + wrap(socket.start + i));
    for (let row = last - 1; row > first; row--) loop.push(row * n + wrap(socket.start));
    const arm = arms[side]!;
    bridge(
      loop,
      Array.from(
        { length: arm.segments },
        (_, i) => armStarts[side]! + (arm.ringHeights.length - 1) * arm.segments + i,
      ),
      0.008,
    );
  });
  const front = n / 4,
    back = (n * 3) / 4;
  const seam = [0.04, 0, -0.04].map((z, i) => {
    const index = vertices.length;
    const v = mix(vertices[front]!, vertices[back]!, (i + 1) / 4, 0);
    v.p = [0, i === 1 ? 0.445 : 0.46, z];
    vertices.push(v);
    return index;
  });
  const right = Array.from({ length: n / 2 + 1 }, (_, i) => wrap(front - i)).concat(
    [...seam].reverse(),
  );
  const left = Array.from({ length: n / 2 + 1 }, (_, i) => wrap(back - i)).concat(seam);
  [right, left].forEach((loop, side) => {
    const leg = legs[side]!;
    bridge(
      loop,
      Array.from(
        { length: leg.segments },
        (_, i) => legStarts[side]! + (leg.ringHeights.length - 1) * leg.segments + i,
      ),
      0,
      { surface: leg, start: legStarts[side]! },
    );
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      vertices.flatMap((v) => v.p),
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute(
      vertices.flatMap((v) => v.uv),
      2,
    ),
  );
  geometry.setAttribute(
    "skinIndex",
    new Uint16BufferAttribute(
      vertices.flatMap((v) => v.bones),
      4,
    ),
  );
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(
      vertices.flatMap((v) => v.weights),
      4,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
