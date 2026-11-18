import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from "three";
import { BONE, type BoneName } from "./humanoid-pose";
import { sculptHumanoid } from "./humanoid-sculpt";

type Point = [number, number, number];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const skinBlend = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
/** A new continuous anatomical surface, sampled once and shared by all identical body builds. */
export function createAnatomicalSurface(
  female: boolean,
  build: number,
  indexOf: Map<BoneName, number>,
  armSpan: number,
  legSpan: number,
) {
  const field = sculptHumanoid(female, build, armSpan, legSpan);
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
    if (y > 0.8 && Math.abs(x) < 0.1) return [BONE.neck, BONE.head, skinBlend((y - 0.81) / 0.05)];
    if (Math.abs(x) > (y < 0.6 ? 0.195 : 0.17) * armSpan && y > 0.38) {
      if (y > 0.72)
        return [BONE.spine2, arm, skinBlend((Math.abs(x) - 0.14 * armSpan) / (0.08 * armSpan))];
      if (y > 0.565) return [arm, forearm, skinBlend((0.65 - y) / 0.08)];
      return [forearm, hand, skinBlend((0.5 - y) / 0.06)];
    }
    if (y < 0.49) {
      const thigh = left ? BONE.lThigh : BONE.rThigh,
        calf = left ? BONE.lCalf : BONE.rCalf,
        foot = left ? BONE.lFoot : BONE.rFoot;
      if (y > 0.4) return [BONE.root, thigh, skinBlend((0.49 - y) / 0.07)];
      if (y > 0.19) return [thigh, calf, skinBlend((0.29 - y) / 0.08)];
      return [calf, foot, skinBlend((0.09 - y) / 0.045)];
    }
    if (y < 0.58) return [BONE.root, BONE.spine, skinBlend((y - 0.52) / 0.06)];
    if (y < 0.67) return [BONE.spine, BONE.spine1, skinBlend((y - 0.58) / 0.06)];
    return [BONE.spine1, BONE.spine2, skinBlend((y - 0.66) / 0.06)];
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
