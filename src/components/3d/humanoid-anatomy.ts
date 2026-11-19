import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BONE, type BoneName } from "./humanoid-pose";
import { HUMANOID_LATERAL_SCALE } from "./humanoid-proportions";
type Point = [number, number, number];
type Ring = { y: number; x: number; z: number; center?: number };
const HEAD: Ring[] = [
  { y: 0.823, x: 0.019, z: 0.021, center: -0.002 },
  { y: 0.845, x: 0.024, z: 0.026, center: -0.002 },
  { y: 0.862, x: 0.025, z: 0.029, center: 0.002 },
  { y: 0.876, x: 0.035, z: 0.039, center: 0.004 },
  { y: 0.89, x: 0.043, z: 0.046, center: 0.002 },
  { y: 0.909, x: 0.047, z: 0.05 },
  { y: 0.929, x: 0.051, z: 0.054 },
  { y: 0.947, x: 0.052, z: 0.055, center: -0.002 },
  { y: 0.965, x: 0.049, z: 0.052, center: -0.004 },
  { y: 0.982, x: 0.039, z: 0.043, center: -0.006 },
  { y: 0.994, x: 0.023, z: 0.028, center: -0.006 },
  { y: 1.001, x: 0.006, z: 0.009, center: -0.006 },
];
function profile(y: number, female: boolean) {
  let i = 0;
  while (i < HEAD.length - 2 && y > HEAD[i + 1]!.y) i++;
  const a = HEAD[i]!,
    b = HEAD[i + 1]!,
    t = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
  return {
    x: (a.x + (b.x - a.x) * t) * (female ? 0.96 : 1),
    z: a.z + (b.z - a.z) * t,
    center: (a.center ?? 0) + ((b.center ?? 0) - (a.center ?? 0)) * t,
  };
}
const bump = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
function facialDepth(x: number, y: number) {
  return (
    0.009 * bump(x, y, 0, 0.928, 0.009, 0.024) +
    0.018 * bump(x, y, 0, 0.907, 0.01, 0.008) +
    0.0035 * bump(x, y, 0, 0.89, 0.016, 0.004) +
    0.004 * bump(x, y, 0, 0.883, 0.014, 0.003) +
    0.003 * bump(x, y, 0, 0.874, 0.02, 0.006) -
    0.0035 * (bump(x, y, -0.018, 0.935, 0.011, 0.007) + bump(x, y, 0.018, 0.935, 0.011, 0.007)) +
    0.003 * (bump(x, y, -0.03, 0.918, 0.014, 0.012) + bump(x, y, 0.03, 0.918, 0.014, 0.012))
  );
}
export function humanFaceFront(x: number, y: number, female: boolean) {
  const r = profile(y, female);
  return r.center + r.z * Math.sqrt(Math.max(0, 1 - (x / r.x) ** 2)) + facialDepth(x, y);
}
/** Authored ring topology spends geometry on eyelids, jaw planes and nose instead of a coarse voxel face. */
export function createHumanAnatomy(
  female: boolean,
  indices: Map<BoneName, number>,
  armSpan: number,
  legSpan: number,
) {
  const parts: BufferGeometry[] = [];
  function rings(rows: Point[][], boneWeights: (p: Point) => [BoneName, BoneName, number]) {
    const positions: number[] = [],
      uv: number[] = [],
      skin: number[] = [],
      weights: number[] = [],
      faces: number[] = [];
    const segments = rows[0]!.length;
    const add = (p: Point, u: number, v: number) => {
      positions.push(...p);
      uv.push(u, v);
      const [a, b, w] = boneWeights(p);
      skin.push(indices.get(w > 0.999 ? b : a)!, indices.get(b)!, 0, 0);
      weights.push(w > 0.999 ? 1 : 1 - w, w > 0.999 ? 0 : w, 0, 0);
    };
    rows.forEach((row, j) => row.forEach((p, i) => add(p, i / segments, j / (rows.length - 1))));
    for (let j = 0; j < rows.length - 1; j++)
      for (let i = 0; i < segments; i++) {
        const a = j * segments + i,
          b = j * segments + ((i + 1) % segments),
          c = (j + 1) * segments + i,
          d = (j + 1) * segments + ((i + 1) % segments);
        faces.push(a, b, c, b, d, c);
      }
    for (const [j, reverse] of [
      [0, false],
      [rows.length - 1, true],
    ] as const) {
      const row = rows[j]!,
        center: Point = [0, 0, 0];
      for (const p of row) for (let k = 0; k < 3; k++) center[k]! += p[k]! / segments;
      const id = positions.length / 3;
      add(center, 0.5, j === 0 ? 0 : 1);
      for (let i = 0; i < segments; i++) {
        const a = j * segments + i,
          b = j * segments + ((i + 1) % segments);
        faces.push(...(reverse ? [id, a, b] : [id, b, a]));
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skin, 4));
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    const flat = geometry.toNonIndexed();
    geometry.dispose();
    parts.push(flat);
  }
  const headRows: Point[][] = [];
  // Additional facial rings keep the mouth and eye plane from collapsing into a single triangle.
  const ys = [
    ...HEAD.map((r) => r.y),
    0.883,
    0.886,
    0.897,
    0.904,
    0.914,
    0.921,
    0.935,
    0.94,
    0.952,
  ].sort((a, b) => a - b);
  for (const y of ys) {
    const r = profile(y, female),
      row: Point[] = [];
    for (let i = 0; i < 24; i++) {
      const theta = (i * Math.PI * 2) / 24,
        x = Math.sin(theta) * r.x,
        front = Math.max(0, Math.cos(theta));
      row.push([x, y, r.center + Math.cos(theta) * r.z + facialDepth(x, y) * front ** 8]);
    }
    headRows.push(row);
  }
  rings(headRows, (p) => {
    const t = Math.max(0, Math.min(1, (p[1] - 0.837) / 0.026));
    return [BONE.neck, BONE.head, t * t * (3 - 2 * t)];
  });
  for (const side of [-1, 1]) {
    rings(
      Array.from({ length: 7 }, (_, j) => {
        const latitude = -Math.PI / 2 + ((j + 0.15) * Math.PI) / 6.3;
        return Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI * 2) / 12;
          return [
            side * 0.054 * (female ? 0.96 : 1) + Math.sin(a) * 0.006 * Math.cos(latitude),
            0.922 + Math.sin(latitude) * 0.016,
            -0.004 + Math.cos(a) * 0.009 * Math.cos(latitude),
          ] as Point;
        });
      }),
      () => [BONE.head, BONE.head, 0],
    );
    const hand = side > 0 ? BONE.lHand : BONE.rHand,
      foot = side > 0 ? BONE.lFoot : BONE.rFoot,
      calf = side > 0 ? BONE.lCalf : BONE.rCalf;
    const handX = side * (0.205 * armSpan + 0.06) * HUMANOID_LATERAL_SCALE;
    const forearm = side > 0 ? BONE.lForearm : BONE.rForearm;
    rings(
      [
        { y: 0.404, x: 0.017, z: 0.011 },
        { y: 0.421, x: 0.023, z: 0.014 },
        { y: 0.44, x: 0.021, z: 0.013 },
        { y: 0.459, x: 0.013, z: 0.01 },
      ].map((r) =>
        Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI * 2) / 12;
          return [handX + Math.sin(a) * r.x, r.y, 0.005 + Math.cos(a) * r.z] as Point;
        }),
      ),
      (p) => {
        const t = Math.max(0, Math.min(1, (0.5 - p[1]) / 0.06));
        return [forearm, hand, t * t * (3 - 2 * t)];
      },
    );
    // Four individual tapered fingers and an opposed thumb; the existing hand bone moves the complete hand.
    for (let finger = 0; finger < 4; finger++) {
      const offset = (finger - 1.5) * 0.0105,
        length = [0.039, 0.05, 0.047, 0.036][finger]!,
        rows: Point[][] = [];
      for (const [t, r] of [
        [0, 0.0052],
        [0.35, 0.005],
        [0.72, 0.0043],
        [1, 0.0026],
      ] as const) {
        const row: Point[] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI * 2) / 8;
          row.push([
            handX + side * offset + Math.sin(a) * r,
            0.416 - t * length,
            0.006 + Math.cos(a) * r * 0.8 + t * 0.002,
          ]);
        }
        rows.push(row);
      }
      // Downward lofts reverse their angular order to preserve outward winding.
      rings(
        rows.map((row) => row.reverse()),
        () => [hand, hand, 0],
      );
    }
    const thumb: Point[][] = [];
    for (const [t, r] of [
      [0, 0.007],
      [0.5, 0.006],
      [1, 0.004],
    ] as const) {
      const row: Point[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        row.push([
          handX - side * (0.014 + t * 0.019) + Math.sin(a) * r,
          0.444 - t * 0.034,
          0.009 + Math.cos(a) * r,
        ]);
      }
      thumb.push(row.reverse());
    }
    rings(thumb, () => [hand, hand, 0]);
    const legX = side * 0.09 * legSpan * HUMANOID_LATERAL_SCALE;
    const footProfile = [
      { y: 0.006, x: 0.023, z: 0.056, center: 0.029 },
      { y: 0.014, x: 0.028, z: 0.064, center: 0.029 },
      { y: 0.032, x: 0.029, z: 0.062, center: 0.027 },
      { y: 0.049, x: 0.025, z: 0.046, center: 0.012 },
      { y: 0.071, x: 0.02, z: 0.026 },
      { y: 0.086, x: 0.018, z: 0.021 },
    ];
    rings(
      footProfile.map((r) =>
        Array.from({ length: 20 }, (_, i) => {
          const a = (i * Math.PI * 2) / 20;
          return [legX + Math.sin(a) * r.x, r.y, (r.center ?? 0) + Math.cos(a) * r.z] as Point;
        }),
      ),
      (p) => {
        const t = Math.max(0, Math.min(1, (0.09 - p[1]) / 0.045));
        return [calf, foot, t * t * (3 - 2 * t)];
      },
    );
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!geometry) throw new Error("Human anatomy could not be built");
  return geometry;
}

/** A fitted scalp with a higher front hairline and a lower back, rather than a hemispherical helmet. */
export function createHumanScalp(female: boolean, headIndex: number) {
  const p: number[] = [],
    uv: number[] = [],
    skin: number[] = [],
    weights: number[] = [],
    faces: number[] = [];
  const segments = 24,
    rows = 9;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments,
        c = Math.cos(a),
        t = j / (rows - 1),
        line = 0.953 + 0.015 * Math.max(0, c) - 0.02 * Math.max(0, -c);
      const y = line + (1.004 - line) * t,
        r = profile(Math.min(0.999, y - 0.003), female),
        shrink = j === rows - 1 ? 0.18 : 1;
      p.push(
        Math.sin(a) * (r.x + 0.002) * shrink,
        y,
        (r.center ?? 0) + Math.cos(a) * (r.z + 0.002) * shrink,
      );
      uv.push(i / segments, t);
      skin.push(headIndex, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i,
        b = j * segments + ((i + 1) % segments),
        c = (j + 1) * segments + i,
        d = (j + 1) * segments + ((i + 1) % segments);
      faces.push(a, b, c, b, d, c);
    }
  const top = p.length / 3;
  p.push(0, 1.005, -0.006);
  uv.push(0.5, 1);
  skin.push(headIndex, 0, 0, 0);
  weights.push(1, 0, 0, 0);
  for (let i = 0; i < segments; i++)
    faces.push(top, (rows - 1) * segments + i, (rows - 1) * segments + ((i + 1) % segments));
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(p, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skin, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  return flat;
}
