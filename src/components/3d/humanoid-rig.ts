import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  LatheGeometry,
  Vector2,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BONE, ROOT_REST_Y, type BoneName } from "./humanoid-pose";
import type { HairShape } from "./hair-shapes";

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

type Part = { geometry: BufferGeometry; bone: BoneName; accessory: boolean };
function skinTo(geometry: BufferGeometry, boneIndex: number): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
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

/** Tapered lathe surface for limbs: avoids the stack-of-balls silhouette while keeping the existing bone contract. */
function taperedSegment(
  radiusBottom: number,
  radiusTop: number,
  length: number,
  at: [number, number, number],
  bone: BoneName,
): Part {
  const half = length / 2;
  const r = radiusBottom;
  const t = radiusTop;
  const geometry = new LatheGeometry(
    [
      new Vector2(0, -half),
      new Vector2(r * 0.62, -half * 0.96),
      new Vector2(r * 0.92, -half * 0.78),
      new Vector2(r, -half * 0.38),
      new Vector2((r + t) * 0.5, half * 0.18),
      new Vector2(t, half * 0.62),
      new Vector2(t * 0.78, half * 0.9),
      new Vector2(0, half),
    ],
    12,
  );
  geometry.translate(...at);
  return { geometry, bone, accessory: false };
}

/** Smooth UV spheres replace the old faceted icosahedra; detail is concentrated around the face and torso. */
function blob(
  radii: [number, number, number],
  at: [number, number, number],
  bone: BoneName,
  options: { detail?: 0 | 1; accessory?: boolean } = {},
): Part {
  const geometry = new SphereGeometry(1, options.detail ? 12 : 8, options.detail ? 8 : 6);
  geometry.scale(...radii);
  geometry.translate(...at);
  return { geometry, bone, accessory: options.accessory ?? false };
}

const SHAPES: Record<BodyVariant, { shoulder: number; waist: number; hip: number; bust: number }> = {
  male: { shoulder: 1, waist: 1, hip: 1, bust: 0 },
  business: { shoulder: 1, waist: 1, hip: 1, bust: 0 },
  female: { shoulder: 0.92, waist: 0.88, hip: 1.1, bust: 1 },
};
const BUILD_FACTORS = [
  { shoulder: 0.9, waist: 0.86, hip: 0.92, limb: 0.9 },
  { shoulder: 1, waist: 1, hip: 1, limb: 1 },
  { shoulder: 1.07, waist: 0.94, hip: 1.02, limb: 1.06 },
  { shoulder: 1.13, waist: 1.02, hip: 1.08, limb: 1.12 },
] as const;

/** Overlapping smooth volumes create continuous-looking muscle transitions at game scale. */
function limbParts(side: 1 | -1, shape: { shoulder: number; hip: number; limb: number }): Part[] {
  const upper = side === 1 ? BONE.lUpperArm : BONE.rUpperArm;
  const fore = side === 1 ? BONE.lForearm : BONE.rForearm;
  const hand = side === 1 ? BONE.lHand : BONE.rHand;
  const thigh = side === 1 ? BONE.lThigh : BONE.rThigh;
  const calf = side === 1 ? BONE.lCalf : BONE.rCalf;
  const foot = side === 1 ? BONE.lFoot : BONE.rFoot;
  const ax = 0.19 * side * shape.shoulder;
  const lx = 0.1 * side * shape.hip;
  const arm = shape.limb;
  const thighWidth = 0.073 * shape.hip * arm;
  const fingerSpread = 0.012 * arm;
  return [
    // Deltoid, upper arm and forearm taper toward the wrist instead of forming oversized balls.
    taperedSegment(0.061 * arm, 0.052 * arm, 0.15, [ax, 0.79, 0], upper),
    taperedSegment(0.052 * arm, 0.038 * arm, 0.23, [ax, 0.665, 0], upper),
    blob([0.039 * arm, 0.047 * arm, 0.039 * arm], [ax, 0.545, 0], fore),
    taperedSegment(0.039 * arm, 0.03 * arm, 0.19, [ax, 0.46, 0], fore),
    // Palm, thumb and four individually readable fingers.
    blob([0.036 * arm, 0.047 * arm, 0.025 * arm], [ax, 0.355, 0.008], hand, { detail: 1 }),
    blob([0.014 * arm, 0.029 * arm, 0.016 * arm], [ax - side * 0.035 * arm, 0.348, 0.012], hand),
    ...[-1.5, -0.5, 0.5, 1.5].map((finger) =>
      blob([0.0065 * arm, 0.027 * arm, 0.008 * arm],
        [ax + finger * fingerSpread, 0.31, 0.018], hand),
    ),
    // Rounded thigh and a narrower calf with an ankle transition.
    taperedSegment(thighWidth, 0.052 * arm, 0.31 * arm, [lx, 0.33, 0], thigh),
    blob([0.048 * arm, 0.055 * arm, 0.047 * arm], [lx, 0.17, 0], calf),
    taperedSegment(0.049 * arm, 0.034 * arm, 0.19 * arm, [lx, 0.12, -0.008], calf),
    blob([0.041 * arm, 0.033 * arm, 0.078 * arm], [lx, 0.02, 0.035], foot, { detail: 1 }),
    // Toe box and heel give the foot a recognizable forward direction.
    blob([0.042 * arm, 0.025 * arm, 0.045 * arm], [lx, 0.012, 0.075], foot),
    blob([0.034 * arm, 0.025 * arm, 0.028 * arm], [lx, 0.018, -0.018], foot),
  ];
}

function bodyParts(variant: BodyVariant, build: number): Part[] {
  const base = SHAPES[variant];
  const factor = BUILD_FACTORS[Math.max(0, Math.min(3, Math.round(build)))]!;
  const shape = {
    shoulder: base.shoulder * factor.shoulder,
    waist: base.waist * factor.waist,
    hip: base.hip * factor.hip,
    bust: base.bust,
    limb: factor.limb,
  };
  const { shoulder, waist, hip, bust } = shape;
  const parts: Part[] = [
    // Narrower rib cage, visible waist taper and a pelvis that connects cleanly to the thighs.
    blob([0.174 * shoulder, 0.105, 0.112], [0, 0.82, 0], BONE.spine2, { detail: 1 }),
    blob([0.158 * shoulder, 0.095, 0.105], [0, 0.745, 0], BONE.spine2, { detail: 1 }),
    blob([0.112 * waist, 0.105, 0.082], [0, 0.625, 0], BONE.spine1, { detail: 1 }),
    blob([0.137 * hip, 0.092, 0.09], [0, 0.505, 0], BONE.root, { detail: 1 }),
    // A visible neck, larger cranium and tapered lower face improve head-to-body proportion.
    blob([0.047, 0.092, 0.047], [0, 0.865, 0], BONE.neck, { detail: 1 }),
    blob([0.096, 0.122, 0.096], [0, 0.95, 0], BONE.head, { detail: 1 }),
    // Jaw, chin and cheek planes blend into the cranium instead of reading as separate beads.
    blob([0.071, 0.052, 0.076], [0, 0.89, 0.025], BONE.head, { detail: 1 }),
    blob([0.029, 0.022, 0.026], [0, 0.866, 0.053], BONE.head, { detail: 1 }),
    blob([0.034, 0.035, 0.027], [0.054, 0.928, 0.055], BONE.head, { detail: 1 }),
    blob([0.034, 0.035, 0.027], [-0.054, 0.928, 0.055], BONE.head, { detail: 1 }),
    // A tapered bridge and rounded tip are skin geometry, not dark painted facial marks.
    blob([0.012, 0.031, 0.016], [0, 0.936, 0.096], BONE.head, { detail: 1 }),
    blob([0.017, 0.014, 0.019], [0, 0.915, 0.108], BONE.head, { detail: 1 }),
    blob([0.022, 0.027, 0.021], [0.09, 0.94, 0], BONE.head, { detail: 1 }),
    blob([0.022, 0.027, 0.021], [-0.09, 0.94, 0], BONE.head, { detail: 1 }),
    // Shoulder caps and a subtle clavicle bridge.
    blob([0.073 * shoulder, 0.068, 0.075], [0.155, 0.79, 0], BONE.spine2, { detail: 1 }),
    blob([0.073 * shoulder, 0.068, 0.075], [-0.155, 0.79, 0], BONE.spine2, { detail: 1 }),
    blob([0.12 * shoulder, 0.012, 0.014], [0.065, 0.84, 0.098], BONE.spine2),
    blob([0.12 * shoulder, 0.012, 0.014], [-0.065, 0.84, 0.098], BONE.spine2),
  ];
  if (bust > 0) {
    parts.push(
      blob([0.073 * bust, 0.06 * bust, 0.064 * bust], [0.073, 0.75, 0.085], BONE.spine2, { detail: 1 }),
      blob([0.073 * bust, 0.06 * bust, 0.064 * bust], [-0.073, 0.75, 0.085], BONE.spine2, { detail: 1 }),
    );
  }
  parts.push(...limbParts(1, shape), ...limbParts(-1, shape));
  return parts;
}

function faceDetailParts(): Part[] {
  return [
    // Brows, nose definition and lips. Eye whites/irises/highlights use their own material meshes below.
    blob([0.024, 0.006, 0.009], [0.038, 0.976, 0.083], BONE.head, { accessory: true }),
    blob([0.024, 0.006, 0.009], [-0.038, 0.976, 0.083], BONE.head, { accessory: true }),
    blob([0.009, 0.0035, 0.004], [0.012, 0.914, 0.122], BONE.head, { accessory: true }),
    blob([0.009, 0.0035, 0.004], [-0.012, 0.914, 0.122], BONE.head, { accessory: true }),
    blob([0.025, 0.005, 0.006], [0, 0.884, 0.092], BONE.head, { accessory: true }),
  ];
}
function eyeWhiteParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.019, 0.012, 0.009], [side * 0.038, 0.956, 0.083], BONE.head),
  );
}
function irisParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.008, 0.0085, 0.005], [side * 0.038, 0.956, 0.092], BONE.head),
  );
}
function pupilParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.0042, 0.0055, 0.003], [side * 0.038, 0.956, 0.096], BONE.head),
  );
}
function highlightParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.0024, 0.0024, 0.0018], [side * 0.038 - 0.002, 0.959, 0.099], BONE.head),
  );
}

function hairParts(shape: HairShape): Part[] {
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

const geometryCache = new Map<string, {
  body: BufferGeometry; face: BufferGeometry; eyes: BufferGeometry; irises: BufferGeometry;
  pupils: BufferGeometry; highlights: BufferGeometry; hair: BufferGeometry;
}>();
function mergeSkinned(parts: readonly Part[], indexOf: Map<BoneName, number>): BufferGeometry {
  const merged = mergeGeometries(parts.map((part) => skinTo(part.geometry, indexOf.get(part.bone) ?? 0)), false);
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

export type Humanoid = { root: Bone; bones: Bone[]; byName: Map<string, Bone>; meshes: SkinnedMesh[] };
export function createHumanoid({
  variant, skinColor, hairColor, hairShape = "cap", build = 1,
}: {
  variant: BodyVariant; skinColor: string; hairColor: string | null; hairShape?: HairShape; build?: number;
}): Humanoid {
  const byName = new Map<string, Bone>();
  const bones: Bone[] = [];
  for (const joint of JOINTS) {
    const bone = new Bone();
    bone.name = joint.name;
    bone.position.set(...joint.offset);
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
  const meshes = [
    makeMesh(geo.body, new MeshStandardMaterial({ color: skinColor, roughness: 0.66, metalness: 0, flatShading: false })),
    makeMesh(geo.face, new MeshStandardMaterial({ color: ACCESSORY_COLOR, roughness: 0.58, flatShading: false })),
    makeMesh(geo.eyes, new MeshStandardMaterial({ color: "#f1e9df", roughness: 0.34, flatShading: false })),
    makeMesh(geo.irises, new MeshStandardMaterial({ color: "#3a2118", roughness: 0.28, flatShading: false })),
    makeMesh(geo.pupils, new MeshStandardMaterial({ color: "#100b09", roughness: 0.18, flatShading: false })),
    makeMesh(geo.highlights, new MeshStandardMaterial({ color: "#fffaf2", roughness: 0.12, emissive: "#fffaf2", emissiveIntensity: 0.08, flatShading: false })),
  ];
  if (hairColor) {
    meshes.push(makeMesh(geo.hair, new MeshStandardMaterial({ color: hairColor, roughness: 0.94, metalness: 0, flatShading: false })));
  }
  return { root, bones, byName, meshes };
}
