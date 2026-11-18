import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from "three";
import { BONE, type BoneName } from "./humanoid-pose";

type Point = [number, number, number];
type Field = (x: number, y: number, z: number) => number;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smoothMin = (a: number, b: number, k = 0.018) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
};
function ellipsoid(c: Point, r: Point): Field {
  return (x, y, z) => {
    const p = [x - c[0], y - c[1], z - c[2]];
    const k0 = Math.hypot(...p.map((v, i) => v / r[i]!));
    const k1 = Math.hypot(...p.map((v, i) => v / (r[i]! * r[i]!)));
    return (k0 * (k0 - 1)) / Math.max(k1, 0.000001);
  };
}
function limb(a: Point, b: Point, ra: number, rb: number): Field {
  const v = b.map((p, i) => p - a[i]!),
    d = v.reduce((s, n) => s + n * n, 0);
  return (x, y, z) => {
    const p = [x - a[0], y - a[1], z - a[2]],
      t = clamp(p.reduce((s, n, i) => s + n * v[i]!, 0) / d);
    return Math.hypot(...p.map((n, i) => n - t * v[i]!)) - (ra + (rb - ra) * t);
  };
}

/** A new continuous anatomical surface, sampled once and shared by all identical body builds. */
export function createAnatomicalSurface(
  female: boolean,
  build: number,
  indexOf: Map<BoneName, number>,
  armSpan: number,
  legSpan: number,
) {
  const width = [0.9, 1, 1.06, 1.12][build] ?? 1,
    hip = (female ? 0.129 : 0.117) * width;
  const fields: Field[] = [
    ellipsoid([0, 0.515, 0], [hip, 0.083, 0.083]),
    ellipsoid([0, 0.605, 0], [(female ? 0.085 : 0.099) * width, 0.105, 0.072]),
    ellipsoid([0, 0.704, 0], [(female ? 0.132 : 0.151) * width, 0.106, 0.084]),
    limb([0, 0.76, 0], [0, 0.852, 0], female ? 0.036 : 0.041, female ? 0.033 : 0.038),
    ellipsoid([0, 0.93, 0.002], [female ? 0.077 : 0.082, 0.071, 0.074]),
    ellipsoid([0, 0.887, 0.006], [female ? 0.057 : 0.064, 0.042, 0.059]),
    limb([0, 0.938, 0.068], [0, 0.906, 0.084], 0.009, 0.012),
  ];
  if (female)
    for (const side of [-1, 1])
      fields.push(ellipsoid([side * 0.055, 0.707, 0.046], [0.065, 0.054, 0.046]));
  for (const side of [-1, 1]) {
    const arm = side * 0.205 * armSpan,
      leg = side * 0.09 * legSpan;
    fields.push(
      limb([0, 0.77, 0], [arm, 0.752, 0], 0.03, 0.036),
      limb(
        [arm, 0.752, 0],
        [arm + side * 0.03, 0.615, 0],
        (female ? 0.043 : 0.052) * width,
        (female ? 0.032 : 0.038) * width,
      ),
      limb(
        [arm + side * 0.03, 0.615, 0],
        [arm + side * 0.06, 0.465, 0],
        (female ? 0.033 : 0.038) * width,
        0.022 * width,
      ),
      ellipsoid([arm + side * 0.06, 0.433, 0.002], [0.025 * width, 0.042, 0.021]),
      limb([arm + side * 0.042, 0.449, 0.012], [arm + side * 0.03, 0.415, 0.02], 0.012, 0.009),
      limb([leg, 0.467, 0], [leg, 0.252, 0], (female ? 0.064 : 0.059) * width, 0.036 * width),
      limb([leg, 0.252, 0], [leg, 0.059, 0], 0.037 * width, 0.022 * width),
      ellipsoid([leg, 0.031, 0.036], [0.034 * width, 0.028, 0.071]),
      ellipsoid([side * 0.079, 0.922, 0], [0.015, 0.026, 0.015]),
    );
  }
  const field: Field = (x, y, z) => fields.reduce((best, f) => smoothMin(best, f(x, y, z)), 1);
  const step = 0.034,
    min: Point = [-0.36, -0.014, -0.16],
    size = [23, 32, 13];
  const nx = size[0]!,
    ny = size[1]!,
    nz = size[2]!,
    values = new Float32Array(nx * ny * nz),
    points: Point[] = [];
  const id = (x: number, y: number, z: number) => (y * nz + z) * nx + x;
  for (let y = 0; y < ny; y++)
    for (let z = 0; z < nz; z++)
      for (let x = 0; x < nx; x++) {
        const p: Point = [min[0] + x * step, min[1] + y * step, min[2] + z * step];
        points[id(x, y, z)] = p;
        values[id(x, y, z)] = field(...p);
      }
  const positions: number[] = [],
    indices: number[] = [],
    edgeVertices = new Map<string, number>(),
    positionVertices = new Map<string, number>();
  function edge(a: number, b: number) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const known = edgeVertices.get(key);
    if (known !== undefined) return known;
    const t = values[a]! / (values[a]! - values[b]!),
      p = points[a]!,
      q = points[b]!;
    const sampled = p.map((n, i) => Math.round((n + (q[i]! - n) * t) * 1e6) / 1e6);
    const positionKey = sampled.join(":");
    let vertex = positionVertices.get(positionKey);
    if (vertex === undefined) {
      vertex = positions.length / 3;
      positions.push(...sampled);
      positionVertices.set(positionKey, vertex);
    }
    edgeVertices.set(key, vertex);
    return vertex;
  }
  const tetrahedra = [
    [0, 5, 1, 6],
    [0, 1, 2, 6],
    [0, 2, 3, 6],
    [0, 3, 7, 6],
    [0, 7, 4, 6],
    [0, 4, 5, 6],
  ];
  for (let y = 0; y < ny - 1; y++)
    for (let z = 0; z < nz - 1; z++)
      for (let x = 0; x < nx - 1; x++) {
        const cube = [
          id(x, y, z),
          id(x + 1, y, z),
          id(x + 1, y + 1, z),
          id(x, y + 1, z),
          id(x, y, z + 1),
          id(x + 1, y, z + 1),
          id(x + 1, y + 1, z + 1),
          id(x, y + 1, z + 1),
        ];
        if (cube.every((i) => values[i]! > 0) || cube.every((i) => values[i]! <= 0)) continue;
        for (const tetra of tetrahedra) {
          const inside = tetra.map((i) => cube[i]!).filter((i) => values[i]! <= 0),
            outside = tetra.map((i) => cube[i]!).filter((i) => values[i]! > 0);
          if (!inside.length || !outside.length) continue;
          const polygon = inside.flatMap((a) => outside.map((b) => edge(a, b)));
          const center = new Vector3();
          polygon.forEach((i) => center.add(new Vector3().fromArray(positions, i * 3)));
          center.multiplyScalar(1 / polygon.length);
          const normal = new Vector3();
          for (const id of outside)
            normal.add(new Vector3(...points[id]!).multiplyScalar(1 / outside.length));
          for (const id of inside)
            normal.sub(new Vector3(...points[id]!).multiplyScalar(1 / inside.length));
          normal.normalize();
          const u = new Vector3()
              .fromArray(positions, polygon[0]! * 3)
              .sub(center)
              .normalize(),
            v = new Vector3().crossVectors(normal, u).normalize();
          polygon.sort((a, b) => {
            const p = new Vector3().fromArray(positions, a * 3).sub(center),
              q = new Vector3().fromArray(positions, b * 3).sub(center);
            return Math.atan2(p.dot(v), p.dot(u)) - Math.atan2(q.dot(v), q.dot(u));
          });
          for (let i = 1; i < polygon.length - 1; i++)
            if (new Set([polygon[0], polygon[i], polygon[i + 1]]).size === 3)
              indices.push(polygon[0]!, polygon[i]!, polygon[i + 1]!);
        }
      }
  const boneIndices: number[] = [],
    weights: number[] = [],
    uv: number[] = [];
  function influences(x: number, y: number): [BoneName, BoneName, number] {
    const left = x > 0,
      arm = left ? BONE.lUpperArm : BONE.rUpperArm,
      forearm = left ? BONE.lForearm : BONE.rForearm,
      hand = left ? BONE.lHand : BONE.rHand;
    if (y > 0.86) return [BONE.head, BONE.head, 0];
    if (y > 0.8 && Math.abs(x) < 0.1) return [BONE.neck, BONE.head, clamp((y - 0.81) / 0.05)];
    if (Math.abs(x) > (y < 0.6 ? 0.195 : 0.17) * armSpan && y > 0.38) {
      if (y > 0.72)
        return [BONE.spine2, arm, clamp((Math.abs(x) - 0.14 * armSpan) / (0.08 * armSpan))];
      if (y > 0.565) return [arm, forearm, clamp((0.65 - y) / 0.08)];
      return [forearm, hand, clamp((0.5 - y) / 0.06)];
    }
    if (y < 0.49) {
      const thigh = left ? BONE.lThigh : BONE.rThigh,
        calf = left ? BONE.lCalf : BONE.rCalf,
        foot = left ? BONE.lFoot : BONE.rFoot;
      if (y > 0.4) return [BONE.root, thigh, clamp((0.49 - y) / 0.07)];
      if (y > 0.19) return [thigh, calf, clamp((0.29 - y) / 0.08)];
      return [calf, foot, clamp((0.09 - y) / 0.045)];
    }
    if (y < 0.58) return [BONE.root, BONE.spine, clamp((y - 0.52) / 0.06)];
    if (y < 0.67) return [BONE.spine, BONE.spine1, clamp((y - 0.58) / 0.06)];
    return [BONE.spine1, BONE.spine2, clamp((y - 0.66) / 0.06)];
  }
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!,
      y = positions[i + 1]!,
      [a, b, w] = influences(x, y);
    boneIndices.push(indexOf.get(a)!, indexOf.get(b)!, 0, 0);
    weights.push(1 - w, w, 0, 0);
    uv.push((x + 0.36) / 0.72, y);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(boneIndices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  return flat;
}
