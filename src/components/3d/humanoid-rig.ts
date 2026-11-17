import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BONE, ROOT_REST_Y, type BoneName } from "./humanoid-pose";
import type { HairShape } from "./hair-shapes";
import { characterSkinTextures } from "./character-skin";

export type BodyVariant = "female" | "male" | "business";
export const ACCESSORY_COLOR = "#241914";

type Joint = { name: BoneName; parent: BoneName | null; offset: [number, number, number] };
export const JOINTS: readonly Joint[] = [
  { name: BONE.root, parent: null, offset: [0, ROOT_REST_Y, 0] },
  { name: BONE.spine, parent: BONE.root, offset: [0, 0.04, 0] },
  { name: BONE.spine1, parent: BONE.spine, offset: [0, 0.08, 0] },
  { name: BONE.spine2, parent: BONE.spine1, offset: [0, 0.08, 0] },
  { name: BONE.neck, parent: BONE.spine2, offset: [0, 0.1, 0] },
  { name: BONE.head, parent: BONE.neck, offset: [0, 0.04, 0] },
  { name: BONE.lUpperArm, parent: BONE.spine2, offset: [0.19, 0.08, 0] },
  { name: BONE.lForearm, parent: BONE.lUpperArm, offset: [0, -0.17, 0] },
  { name: BONE.lHand, parent: BONE.lForearm, offset: [0, -0.15, 0] },
  { name: BONE.rUpperArm, parent: BONE.spine2, offset: [-0.19, 0.08, 0] },
  { name: BONE.rForearm, parent: BONE.rUpperArm, offset: [0, -0.17, 0] },
  { name: BONE.rHand, parent: BONE.rForearm, offset: [0, -0.15, 0] },
  { name: BONE.lThigh, parent: BONE.root, offset: [0.09, -0.02, 0] },
  { name: BONE.lCalf, parent: BONE.lThigh, offset: [0, -0.23, 0] },
  { name: BONE.lFoot, parent: BONE.lCalf, offset: [0, -0.2, 0] },
  { name: BONE.rThigh, parent: BONE.root, offset: [-0.09, -0.02, 0] },
  { name: BONE.rCalf, parent: BONE.rThigh, offset: [0, -0.23, 0] },
  { name: BONE.rFoot, parent: BONE.rCalf, offset: [0, -0.2, 0] },
];

type Part = { geometry: BufferGeometry; bone: BoneName; accessory: boolean; preSkinned?: boolean };
function skinTo(geometry: BufferGeometry, boneIndex: number, preSkinned = false): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (preSkinned) return flat;
  const count = flat.attributes["position"]!.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    indices[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  flat.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
  flat.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  return flat;
}

type ProfileRing = { y: number; x: number; z: number; cx?: number; cz?: number };
type RingWeights = readonly [BoneName, BoneName, number];

/** Closed polygonal cross-sections. Ring weights keep elbows and knees joined as they bend. */
function profilePart(
  rings: readonly ProfileRing[],
  weightsFor: (y: number) => RingWeights,
  segments = 20,
): Part {
  const positions: number[] = [],
    indices: number[] = [],
    uvs: number[] = [];
  const skinIndices: number[] = [],
    skinWeights: number[] = [];
  const append = (x: number, y: number, z: number, u: number) => {
    positions.push(x, y, z);
    uvs.push(u, y);
    const [lower, upper, blend] = weightsFor(y);
    skinIndices.push(
      JOINTS.findIndex((j) => j.name === lower),
      JOINTS.findIndex((j) => j.name === upper),
      0,
      0,
    );
    skinWeights.push(1 - blend, blend, 0, 0);
  };
  rings.forEach((ring) => {
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      append(
        (ring.cx ?? 0) + Math.cos(angle) * ring.x,
        ring.y,
        (ring.cz ?? 0) + Math.sin(angle) * ring.z,
        i / segments,
      );
    }
  });
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * segments + i,
        b = r * segments + ((i + 1) % segments);
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  for (const top of [false, true]) {
    const ring = rings[top ? rings.length - 1 : 0]!;
    const center = positions.length / 3;
    append(ring.cx ?? 0, ring.y, ring.cz ?? 0, 0.5);
    const start = top ? (rings.length - 1) * segments : 0;
    for (let i = 0; i < segments; i++) {
      const a = start + i,
        b = start + ((i + 1) % segments);
      indices.push(...(top ? [center, b, a] : [center, a, b]));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, bone: BONE.root, accessory: false, preSkinned: true };
}

/** Extra silhouette detail for fingers, feet, ears and the face. */
function blob(
  radii: [number, number, number],
  at: [number, number, number],
  bone: BoneName,
  options: { detail?: 0 | 1; accessory?: boolean } = {},
): Part {
  const geometry = new SphereGeometry(1, options.detail ? 12 : 10, options.detail ? 8 : 7);
  geometry.scale(...radii);
  geometry.translate(...at);
  return { geometry, bone, accessory: options.accessory ?? false };
}

const BASE_SHAPE = {
  shoulder: 1,
  waist: 1,
  hip: 1,
  bust: 0,
  arm: 1,
  leg: 1,
  thigh: 1,
  armSpan: 1,
  legSpan: 1,
  jaw: 1,
  faceWidth: 1,
  neck: 1,
  hand: 1,
  foot: 1,
};
/** Body and wardrobe use the same proportions; saved build indices remain unchanged. */
export const HUMANOID_SHAPES: Record<BodyVariant, typeof BASE_SHAPE> = {
  male: { ...BASE_SHAPE },
  business: { ...BASE_SHAPE },
  female: {
    ...BASE_SHAPE,
    shoulder: 0.86,
    waist: 0.9,
    hip: 1.13,
    bust: 0.85,
    arm: 0.82,
    leg: 0.96,
    thigh: 1.12,
    armSpan: 0.92,
    legSpan: 1.06,
    jaw: 0.87,
    faceWidth: 0.96,
    neck: 0.88,
    hand: 0.88,
    foot: 0.94,
  },
};
export const HUMANOID_BUILD_FACTORS = [
  { shoulder: 0.9, waist: 0.86, hip: 0.92, limb: 0.9 },
  { shoulder: 1, waist: 1, hip: 1, limb: 1 },
  { shoulder: 1.07, waist: 0.94, hip: 1.02, limb: 1.06 },
  { shoulder: 1.13, waist: 1.02, hip: 1.08, limb: 1.12 },
] as const;

/** A single closed torso surface with blended root/spine skin weights. */
function torsoSurface(shape: { shoulder: number; waist: number; hip: number; bust: number }): Part {
  const rings = [
    { y: 0.49, x: 0.105 * shape.hip, z: 0.075 },
    { y: 0.53, x: 0.137 * shape.hip, z: 0.09 },
    { y: 0.58, x: 0.13 * shape.waist, z: 0.085 },
    { y: 0.63, x: 0.112 * shape.waist, z: 0.08 },
    { y: 0.68, x: 0.13 * shape.waist, z: 0.09 },
    ...(shape.bust ? [{ y: 0.705, x: 0.143 * shape.shoulder, z: 0.097 }] : []),
    { y: 0.73, x: 0.157 * shape.shoulder, z: 0.105 },
    ...(shape.bust ? [{ y: 0.755, x: 0.17 * shape.shoulder, z: 0.108 }] : []),
    { y: 0.78, x: 0.174 * shape.shoulder, z: 0.112 },
    ...(shape.bust ? [{ y: 0.805, x: 0.17 * shape.shoulder, z: 0.108 }] : []),
    { y: 0.83, x: 0.165 * shape.shoulder, z: 0.105 },
    { y: 0.85, x: 0.13 * shape.shoulder, z: 0.073 },
    { y: 0.88, x: 0.046, z: 0.043 },
  ];
  const radialSegments = 32;
  const positions: number[] = [];
  const indices: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const uvs: number[] = [];
  const rootIndex = JOINTS.findIndex((joint) => joint.name === BONE.root);
  const spine1Index = JOINTS.findIndex((joint) => joint.name === BONE.spine1);
  const spine2Index = JOINTS.findIndex((joint) => joint.name === BONE.spine2);
  for (const ring of rings) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const front = Math.max(0, Math.sin(angle));
      const back = Math.max(0, -Math.sin(angle));
      const frontFullness =
        shape.bust > 0
          ? front *
            shape.bust *
            0.05 *
            Math.exp(-Math.pow((ring.y - 0.755) / 0.045, 2)) *
            Math.exp(-Math.pow((Math.abs(Math.cos(angle)) - 0.48) / 0.32, 2))
          : ring.y >= 0.7 && ring.y <= 0.81
            ? front *
              (0.008 + 0.014 * Math.exp(-Math.pow((Math.abs(Math.cos(angle)) - 0.5) / 0.3, 2)))
            : 0;
      const backFullness =
        ring.y >= 0.5 && ring.y <= 0.59 ? (0.008 + shape.bust * 0.008) * back : 0;
      positions.push(
        Math.cos(angle) * ring.x,
        ring.y,
        Math.sin(angle) * (ring.z + frontFullness + backFullness),
      );
      uvs.push(segment / radialSegments, ring.y);
      let lower = rootIndex;
      let upper = spine1Index;
      let blend = Math.max(0, Math.min(1, (ring.y - 0.53) / 0.15));
      if (ring.y >= 0.68) {
        lower = spine1Index;
        upper = spine2Index;
        blend = Math.max(0, Math.min(1, (ring.y - 0.63) / 0.1));
      }
      skinIndices.push(lower, upper, 0, 0);
      skinWeights.push(1 - blend, blend, 0, 0);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const a = ring * radialSegments + segment;
      const b = ring * radialSegments + ((segment + 1) % radialSegments);
      const c = (ring + 1) * radialSegments + segment;
      const d = (ring + 1) * radialSegments + ((segment + 1) % radialSegments);
      indices.push(a, c, b, b, c, d);
    }
  }
  // Close the lower pelvis and upper neckline so the shell has no open boundary rings.
  const bottomCenter = positions.length / 3;
  positions.push(0, rings[0]!.y, 0);
  uvs.push(0.5, rings[0]!.y);
  skinIndices.push(rootIndex, rootIndex, 0, 0);
  skinWeights.push(1, 0, 0, 0);
  const topCenter = positions.length / 3;
  positions.push(0, rings[rings.length - 1]!.y, 0);
  uvs.push(0.5, rings[rings.length - 1]!.y);
  skinIndices.push(spine2Index, spine2Index, 0, 0);
  skinWeights.push(1, 0, 0, 0);
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments;
    indices.push(bottomCenter, segment, next);
    const topStart = (rings.length - 1) * radialSegments;
    indices.push(topCenter, topStart + next, topStart + segment);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, bone: BONE.root, accessory: false, preSkinned: true };
}

/** Rest surfaces follow the existing shoulder/elbow/wrist and hip/knee/ankle pivots. */
function limbParts(side: 1 | -1, shape: typeof BASE_SHAPE & { limb: number }): Part[] {
  const upper = side === 1 ? BONE.lUpperArm : BONE.rUpperArm;
  const fore = side === 1 ? BONE.lForearm : BONE.rForearm;
  const hand = side === 1 ? BONE.lHand : BONE.rHand;
  const thigh = side === 1 ? BONE.lThigh : BONE.rThigh;
  const calf = side === 1 ? BONE.lCalf : BONE.rCalf;
  const foot = side === 1 ? BONE.lFoot : BONE.rFoot;
  const ax = side * 0.19 * shape.armSpan;
  const lx = side * 0.09 * shape.legSpan;
  const mass = shape.limb;
  const arm = profilePart(
    [
      { y: 0.445, x: 0.021, z: 0.022 },
      { y: 0.47, x: 0.025, z: 0.026 },
      { y: 0.52, x: 0.038, z: 0.035 },
      { y: 0.57, x: 0.04, z: 0.038 },
      { y: 0.61, x: 0.032, z: 0.032 },
      { y: 0.65, x: 0.041, z: 0.041 },
      { y: 0.71, x: 0.051, z: 0.047 },
      { y: 0.77, x: 0.055, z: 0.049 },
      { y: 0.805, x: 0.052, z: 0.045 },
      { y: 0.835, x: 0.028, z: 0.031 },
    ].map((r) => ({
      ...r,
      x: r.x * mass * shape.arm,
      z: r.z * mass * shape.arm,
      cx: r.y > 0.805 ? ax * 0.9 : ax,
    })),
    (y) =>
      y >= 0.77
        ? [upper, BONE.spine2, Math.min(1, (y - 0.77) / 0.065)]
        : [fore, upper, Math.max(0, Math.min(1, (y - 0.59) / 0.04))],
    20,
  );
  const leg = profilePart(
    [
      { y: 0.04, x: 0.025, z: 0.029 },
      { y: 0.075, x: 0.027, z: 0.031 },
      { y: 0.13, x: 0.039, z: 0.039, cz: -0.008 },
      { y: 0.19, x: 0.043, z: 0.044, cz: -0.006 },
      { y: 0.25, x: 0.037, z: 0.037 },
      { y: 0.3, x: 0.052, z: 0.05 },
      { y: 0.38, x: 0.065, z: 0.064 },
      { y: 0.46, x: 0.069, z: 0.07 },
      { y: 0.51, x: 0.061, z: 0.063 },
      { y: 0.55, x: 0.036, z: 0.046 },
    ].map((r) => ({
      ...r,
      x: r.x * mass * shape.leg * (r.y > 0.25 ? shape.thigh : 1),
      z: r.z * mass * shape.leg * (r.y > 0.25 ? shape.thigh : 1),
      cx: lx,
    })),
    (y) =>
      y >= 0.46
        ? [thigh, BONE.root, Math.min(1, (y - 0.46) / 0.08)]
        : [calf, thigh, Math.max(0, Math.min(1, (y - 0.23) / 0.04))],
    20,
  );
  return [
    arm,
    leg,
    blob(
      [0.03 * mass * shape.hand, 0.041 * shape.hand, 0.017 * shape.hand],
      [ax, 0.423, 0.004],
      hand,
    ),
    blob(
      [0.012 * shape.hand, 0.027 * shape.hand, 0.013 * shape.hand],
      [ax - side * 0.028 * shape.hand, 0.418, 0.015],
      hand,
    ),
    ...[-1.5, -0.5, 0.5, 1.5].map((finger) =>
      blob(
        [0.006 * shape.hand, (0.026 - Math.abs(finger) * 0.003) * shape.hand, 0.008 * shape.hand],
        [ax + finger * 0.013 * shape.hand, 0.377, 0.009],
        hand,
      ),
    ),
    blob([0.032 * shape.foot, 0.031, 0.062 * shape.foot], [lx, 0.03, 0.026], foot),
    blob([0.035 * shape.foot, 0.021, 0.038 * shape.foot], [lx, 0.018, 0.064], foot),
  ];
}

function headPart(variant: BodyVariant): Part {
  const shape = HUMANOID_SHAPES[variant];
  return profilePart(
    [
      { y: 0.902, x: 0.031, z: 0.031, cz: 0.014 },
      { y: 0.919, x: 0.047, z: 0.04, cz: 0.012 },
      { y: 0.946, x: 0.063, z: 0.049, cz: 0.006 },
      { y: 0.978, x: 0.073, z: 0.055 },
      { y: 1.008, x: 0.071, z: 0.058, cz: -0.002 },
      { y: 1.038, x: 0.063, z: 0.052, cz: -0.004 },
      { y: 1.059, x: 0.035, z: 0.031, cz: -0.004 },
      { y: 1.066, x: 0.008, z: 0.008, cz: -0.004 },
    ].map((ring) => ({ ...ring, x: ring.x * (ring.y < 0.95 ? shape.jaw : shape.faceWidth) })),
    () => [BONE.head, BONE.head, 0],
    24,
  );
}

function bodyParts(variant: BodyVariant, build: number): Part[] {
  const base = HUMANOID_SHAPES[variant];
  const factor = HUMANOID_BUILD_FACTORS[Math.max(0, Math.min(3, Math.round(build)))]!;
  const shape = {
    ...base,
    shoulder: base.shoulder * factor.shoulder,
    waist: base.waist * factor.waist,
    hip: base.hip * factor.hip,
    bust: base.bust,
    limb: factor.limb,
  };
  const parts: Part[] = [
    // One continuous torso shell replaces the disconnected chest, abdomen and pelvis spheres.
    torsoSurface(shape),
    profilePart(
      [
        { y: 0.845, x: 0.044 * shape.neck, z: 0.041 * shape.neck },
        { y: 0.88, x: 0.038 * shape.neck, z: 0.036 * shape.neck },
        { y: 0.922, x: 0.033 * shape.neck, z: 0.034 * shape.neck },
      ],
      (y) => [BONE.spine2, BONE.head, Math.max(0, Math.min(1, (y - 0.855) / 0.055))],
    ),
    headPart(variant),
    // Angular nose, small ears and a restrained lower lip keep the face readable at game scale.
    blob([0.009, 0.023, 0.01], [0, 0.976, 0.063], BONE.head),
    blob([0.014, 0.01, 0.013], [0, 0.961, 0.073], BONE.head),
    blob([0.013, 0.023, 0.013], [0.073 * shape.faceWidth, 0.971, -0.003], BONE.head),
    blob([0.013, 0.023, 0.013], [-0.073 * shape.faceWidth, 0.971, -0.003], BONE.head),
    blob([0.021, 0.005, 0.007], [0, 0.935, 0.059], BONE.head),
  ];
  parts.push(...limbParts(1, shape), ...limbParts(-1, shape));
  return parts;
}

function faceDetailParts(): Part[] {
  return [
    blob([0.019, 0.004, 0.005], [0.029, 1.006, 0.053], BONE.head),
    blob([0.019, 0.004, 0.005], [-0.029, 1.006, 0.053], BONE.head),
    blob([0.004, 0.0025, 0.002], [0.008, 0.958, 0.084], BONE.head),
    blob([0.004, 0.0025, 0.002], [-0.008, 0.958, 0.084], BONE.head),
    blob([0.021, 0.0025, 0.003], [0, 0.941, 0.061], BONE.head),
  ];
}
function eyeWhiteParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.015, 0.007, 0.005], [side * 0.029, 0.991, 0.054], BONE.head),
  );
}
function irisParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.006, 0.006, 0.003], [side * 0.029, 0.991, 0.059], BONE.head),
  );
}
function pupilParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.003, 0.004, 0.002], [side * 0.029, 0.991, 0.062], BONE.head),
  );
}
function highlightParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.0016, 0.0016, 0.001], [side * 0.029 - 0.0015, 0.993, 0.064], BONE.head),
  );
}

function hairVolumes(shape: HairShape): Part[] {
  // Hair masses sit behind the facial plane (+z is the face on this rig).
  const base = blob([0.09, 0.071, 0.09], [0, 0.985, -0.03], BONE.head, { detail: 1 });
  if (shape === "afro") {
    return [blob([0.116, 0.103, 0.09], [0, 1.005, -0.035], BONE.head, { detail: 1 })];
  }
  if (shape === "buzz") {
    return [blob([0.09, 0.057, 0.07], [0, 1.002, -0.025], BONE.head, { detail: 1 })];
  }
  if (shape === "braids") {
    const parts: Part[] = [base];
    for (let row = -2; row <= 2; row += 1) {
      const x = row * 0.029;
      parts.push(
        blob([0.012, 0.013, 0.073], [x, 1.025, -0.018], BONE.head),
        blob([0.013, 0.012, 0.062], [x + 0.006, 1.018, -0.045], BONE.head),
      );
    }
    for (const side of [-1, 1] as const) {
      parts.push(
        blob([0.018, 0.07, 0.022], [side * 0.083, 0.94, -0.035], BONE.head, { detail: 1 }),
        blob([0.014, 0.065, 0.018], [side * 0.088, 0.86, -0.025], BONE.head),
      );
    }
    return parts;
  }
  if (shape === "locs") {
    const parts: Part[] = [base];
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 3; i += 1) {
        const x = side * (0.07 + (i % 2) * 0.012);
        const z = -0.06 + i * 0.035;
        parts.push(
          blob([0.018, 0.065, 0.02], [x, 0.93 - (i % 2) * 0.015, z], BONE.head, { detail: 1 }),
          blob([0.016, 0.055, 0.018], [x * 1.04, 0.84 - (i % 2) * 0.015, z + 0.008], BONE.head),
        );
      }
    }
    for (let i = 0; i < 3; i += 1) {
      parts.push(blob([0.017, 0.075, 0.018], [(i - 1) * 0.035, 0.91, -0.105], BONE.head));
    }
    return parts;
  }
  if (shape === "knots") {
    const parts: Part[] = [base];
    for (const x of [-0.055, 0, 0.055]) {
      for (const z of [-0.055, 0.005]) {
        parts.push(blob([0.027, 0.03, 0.027], [x, 1.055, z], BONE.head, { detail: 1 }));
      }
    }
    return parts;
  }
  if (shape === "bun") {
    return [
      base,
      blob([0.047, 0.045, 0.045], [0, 1.005, -0.105], BONE.head, { detail: 1 }),
      blob([0.018, 0.058, 0.018], [0, 0.94, -0.105], BONE.head),
    ];
  }
  return [base];
}

function hairParts(shape: HairShape): Part[] {
  if (shape === "cap" || shape === "buzz") {
    const geometry = new SphereGeometry(1, 20, 7, 0, Math.PI * 2, 0, Math.PI * 0.56);
    geometry.scale(0.076, shape === "buzz" ? 0.041 : 0.049, 0.062);
    geometry.translate(0, 1.026, -0.004);
    return [{ geometry, bone: BONE.head, accessory: false }];
  }
  return hairVolumes(shape).map((part) => {
    part.geometry.scale(0.8, 0.87, 0.8);
    part.geometry.translate(0, 0.15, 0);
    return part;
  });
}

const geometryCache = new Map<
  string,
  {
    body: BufferGeometry;
    face: BufferGeometry;
    eyes: BufferGeometry;
    irises: BufferGeometry;
    pupils: BufferGeometry;
    highlights: BufferGeometry;
    hair: BufferGeometry;
  }
>();
function mergeSkinned(parts: readonly Part[], indexOf: Map<BoneName, number>): BufferGeometry {
  const merged = mergeGeometries(
    parts.map((part) => skinTo(part.geometry, indexOf.get(part.bone) ?? 0, part.preSkinned)),
    false,
  );
  if (!merged) throw new Error("Humanoid geometry could not be merged");
  return merged;
}
function geometriesFor(variant: BodyVariant, hairShape: HairShape, build: number) {
  const normalizedBuild = Math.max(0, Math.min(3, Math.round(build)));
  const key = `${variant}:${hairShape}:${normalizedBuild}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const indexOf = new Map(JOINTS.map((joint, index) => [joint.name, index]));
  const parts = bodyParts(variant, normalizedBuild);
  const built = {
    body: mergeSkinned(parts, indexOf),
    face: mergeSkinned(faceDetailParts(), indexOf),
    eyes: mergeSkinned(eyeWhiteParts(), indexOf),
    irises: mergeSkinned(irisParts(), indexOf),
    pupils: mergeSkinned(pupilParts(), indexOf),
    highlights: mergeSkinned(highlightParts(), indexOf),
    hair: mergeSkinned(hairParts(hairShape), indexOf),
  };
  geometryCache.set(key, built);
  return built;
}

export type Humanoid = {
  root: Bone;
  bones: Bone[];
  byName: Map<string, Bone>;
  meshes: SkinnedMesh[];
};
export function createHumanoid({
  variant,
  skinColor,
  hairColor,
  hairShape = "cap",
  build = 1,
}: {
  variant: BodyVariant;
  skinColor: string;
  hairColor: string | null;
  hairShape?: HairShape;
  build?: number;
}): Humanoid {
  const byName = new Map<string, Bone>();
  const bones: Bone[] = [];
  for (const joint of JOINTS) {
    const bone = new Bone();
    bone.name = joint.name;
    const shape = HUMANOID_SHAPES[variant];
    const span =
      joint.name === BONE.lUpperArm || joint.name === BONE.rUpperArm
        ? shape.armSpan
        : joint.name === BONE.lThigh || joint.name === BONE.rThigh
          ? shape.legSpan
          : 1;
    bone.position.set(joint.offset[0] * span, joint.offset[1], joint.offset[2]);
    if (joint.parent) byName.get(joint.parent)!.add(bone);
    byName.set(joint.name, bone);
    bones.push(bone);
  }
  const root = byName.get(BONE.root)!;
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  const geo = geometriesFor(variant, hairShape, build);
  const makeMesh = (geometry: BufferGeometry, material: MeshStandardMaterial) => {
    const mesh = new SkinnedMesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);
    return mesh;
  };
  const skinTextures = characterSkinTextures();
  const meshes = [
    makeMesh(
      geo.body,
      new MeshStandardMaterial({
        color: skinColor,
        roughness: 0.76,
        map: skinTextures.color,
        roughnessMap: skinTextures.roughness,
        metalness: 0,
        flatShading: false,
      }),
    ),
    makeMesh(
      geo.face,
      new MeshStandardMaterial({ color: ACCESSORY_COLOR, roughness: 0.58, flatShading: false }),
    ),
    makeMesh(
      geo.eyes,
      new MeshStandardMaterial({ color: "#f1e9df", roughness: 0.34, flatShading: false }),
    ),
    makeMesh(
      geo.irises,
      new MeshStandardMaterial({ color: "#3a2118", roughness: 0.28, flatShading: false }),
    ),
    makeMesh(
      geo.pupils,
      new MeshStandardMaterial({ color: "#100b09", roughness: 0.18, flatShading: false }),
    ),
    makeMesh(
      geo.highlights,
      new MeshStandardMaterial({
        color: "#fffaf2",
        roughness: 0.12,
        emissive: "#fffaf2",
        emissiveIntensity: 0.08,
        flatShading: false,
      }),
    ),
  ];
  if (hairColor) {
    meshes.push(
      makeMesh(
        geo.hair,
        new MeshStandardMaterial({
          color: hairColor,
          roughness: 0.94,
          metalness: 0,
          flatShading: false,
        }),
      ),
    );
  }
  return { root, bones, byName, meshes };
}
