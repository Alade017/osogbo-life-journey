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
import { createAnatomicalSurface } from "./humanoid-surface";
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
  { name: BONE.lUpperArm, parent: BONE.spine2, offset: [0.205, 0.08, 0] },
  { name: BONE.lForearm, parent: BONE.lUpperArm, offset: [0.03, -0.17, 0] },
  { name: BONE.lHand, parent: BONE.lForearm, offset: [0.03, -0.15, 0] },
  { name: BONE.rUpperArm, parent: BONE.spine2, offset: [-0.205, 0.08, 0] },
  { name: BONE.rForearm, parent: BONE.rUpperArm, offset: [-0.03, -0.17, 0] },
  { name: BONE.rHand, parent: BONE.rForearm, offset: [-0.03, -0.15, 0] },
  { name: BONE.lThigh, parent: BONE.root, offset: [0.09, -0.02, 0] },
  { name: BONE.lCalf, parent: BONE.lThigh, offset: [0, -0.23, 0] },
  { name: BONE.lFoot, parent: BONE.lCalf, offset: [0, -0.2, 0] },
  { name: BONE.rThigh, parent: BONE.root, offset: [-0.09, -0.02, 0] },
  { name: BONE.rCalf, parent: BONE.rThigh, offset: [0, -0.23, 0] },
  { name: BONE.rFoot, parent: BONE.rCalf, offset: [0, -0.2, 0] },
];

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

export type Humanoid = {
  root: Bone;
  bones: Bone[];
  byName: Map<string, Bone>;
  meshes: SkinnedMesh[];
};
const geometryCache = new Map<string, BufferGeometry[]>();
function details(
  parts: { r: [number, number, number]; p: [number, number, number]; cap?: boolean }[],
  head: number,
) {
  const geometries = parts.map(({ r, p, cap }) => {
    const g = new SphereGeometry(
      1,
      8,
      6,
      0,
      Math.PI * 2,
      0,
      cap ? Math.PI * 0.58 : Math.PI,
    ).toNonIndexed();
    g.scale(...r);
    g.translate(...p);
    const n = g.getAttribute("position").count,
      indices = new Uint16Array(n * 4),
      weights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      indices[i * 4] = head;
      weights[i * 4] = 1;
    }
    g.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
    g.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
    return g;
  });
  const merged = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  if (!merged) throw Error("Character detail geometry could not be built");
  return merged;
}
function geometryFor(variant: BodyVariant, hair: HairShape, build: number) {
  const key = `${variant}:${hair}:${build}`,
    cached = geometryCache.get(key);
  if (cached) return cached;
  const shape = HUMANOID_SHAPES[variant],
    head = JOINTS.findIndex((j) => j.name === BONE.head),
    faceWidth = shape.faceWidth;
  const index = new Map(JOINTS.map((j, i) => [j.name, i]));
  const face = details(
    [
      { r: [0.025, 0.004, 0.005], p: [-0.033 * faceWidth, 0.951, 0.066] },
      { r: [0.025, 0.004, 0.005], p: [0.033 * faceWidth, 0.951, 0.066] },
      { r: [0.022, 0.0035, 0.007], p: [0, 0.887, 0.064] },
    ],
    head,
  );
  const eyes = details(
    [-1, 1].map((side) => ({
      r: [0.017, 0.008, 0.006] as [number, number, number],
      p: [side * 0.033 * faceWidth, 0.931, 0.071] as [number, number, number],
    })),
    head,
  );
  const irises = details(
    [-1, 1].map((side) => ({
      r: [0.0065, 0.0065, 0.003] as [number, number, number],
      p: [side * 0.033 * faceWidth, 0.931, 0.077] as [number, number, number],
    })),
    head,
  );
  const pupils = details(
    [-1, 1].map((side) => ({
      r: [0.003, 0.004, 0.0018] as [number, number, number],
      p: [side * 0.033 * faceWidth, 0.931, 0.08] as [number, number, number],
    })),
    head,
  );
  const highlights = details(
    [-1, 1].map((side) => ({
      r: [0.0015, 0.0015, 0.001] as [number, number, number],
      p: [side * 0.033 * faceWidth - 0.002, 0.934, 0.082] as [number, number, number],
    })),
    head,
  );
  const hairParts: { r: [number, number, number]; p: [number, number, number]; cap?: boolean }[] = [
    {
      r:
        hair === "afro"
          ? [0.105, 0.094, 0.096]
          : hair === "buzz"
            ? [0.084, 0.056, 0.077]
            : [0.087, 0.069, 0.08],
      p: [0, 0.95, -0.004],
      cap: true,
    },
  ];
  if (hair === "bun") hairParts.push({ r: [0.043, 0.041, 0.04], p: [0, 1.011, -0.061] });
  if (hair === "locs" || hair === "braids" || hair === "knots")
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7;
      hairParts.push({
        r: hair === "knots" ? [0.022, 0.022, 0.022] : [0.012, 0.067, 0.013],
        p: [Math.sin(a) * 0.068, hair === "knots" ? 1.014 : 0.94, Math.cos(a) * 0.059 - 0.014],
      });
    }
  const geo = [
    createAnatomicalSurface(variant === "female", build, index, shape.armSpan, shape.legSpan),
    face,
    eyes,
    irises,
    pupils,
    highlights,
    details(hairParts, head),
  ];
  geometryCache.set(key, geo);
  return geo;
}
/** Adult low-poly humanoid: one continuous skinned anatomical shell and bone-bound facial details. */
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
  const byName = new Map<string, Bone>(),
    bones: Bone[] = [];
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
  const skeleton = new Skeleton(bones),
    geometry = geometryFor(variant, hairShape, Math.max(0, Math.min(3, Math.round(build))));
  const maps = characterSkinTextures();
  const materials = [
    new MeshStandardMaterial({
      color: skinColor,
      map: maps.color,
      roughnessMap: maps.roughness,
      roughness: 0.8,
      metalness: 0,
    }),
    new MeshStandardMaterial({ color: ACCESSORY_COLOR, roughness: 0.8 }),
    new MeshStandardMaterial({ color: "#e9dfd2", roughness: 0.5 }),
    new MeshStandardMaterial({ color: "#4b3021", roughness: 0.5 }),
    new MeshStandardMaterial({ color: "#130e0c", roughness: 0.5 }),
    new MeshStandardMaterial({ color: "#fffaf0", roughness: 0.3 }),
  ];
  if (hairColor) materials.push(new MeshStandardMaterial({ color: hairColor, roughness: 0.95 }));
  const meshes = materials.map((material, i) => {
    const mesh = new SkinnedMesh(geometry[i]!, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);
    return mesh;
  });
  return { root, bones, byName, meshes };
}
