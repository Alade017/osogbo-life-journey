import { CHARACTER_GROUND } from "./character-config";
import type { TopCut } from "@/game/wearable-outfits";
import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { BONE } from "./humanoid-pose";
import { adireTexture } from "./cloth-patterns";
const GARMENT_FIT = {
  waist: 0.515,
  collar: 0.814,
  collarSlope: 0.08,
  shoeTop: 0.067,
  sleeves: { tee: 0.657, "long-sleeve": 0.482 },
  clearance: { top: 0.012, bottom: 0.009, shoes: 0.006 },
} as const;

function shirtLowerBoundary(arm: boolean, cut: TopCut): number {
  return arm ? GARMENT_FIT.sleeves[cut] : GARMENT_FIT.waist;
}

function collarBoundary(x: number): number {
  return GARMENT_FIT.collar + GARMENT_FIT.collarSlope * Math.abs(x);
}

const armBones = new Set<string>([
  BONE.lUpperArm,
  BONE.rUpperArm,
  BONE.lForearm,
  BONE.rForearm,
  BONE.lHand,
  BONE.rHand,
]);
const ARM_WEIGHT_THRESHOLD = 0.25;

const cache = new WeakMap<BufferGeometry, Map<TopCut, BufferGeometry>>();
type Vertex = { p: number[]; n: number[]; uv: number[]; bones: Map<number, number> };
function interpolate(a: Vertex, b: Vertex, t: number): Vertex {
  const mix = (p: number[], q: number[]) => p.map((v, i) => v + (q[i]! - v) * t);
  const bones = new Map<number, number>();
  for (const [bone, w] of a.bones) bones.set(bone, w * (1 - t));
  for (const [bone, w] of b.bones) bones.set(bone, (bones.get(bone) ?? 0) + w * t);
  return { p: mix(a.p, b.p), n: mix(a.n, b.n), uv: mix(a.uv, b.uv), bones };
}
/** Clip at real sleeve/collar/hem boundaries instead of discarding whole triangles. */
function clip(vertices: Vertex[], distance: (v: Vertex) => number) {
  const output: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!,
      b = vertices[(i + 1) % vertices.length]!,
      da = distance(a),
      db = distance(b);
    if (da >= 0) output.push(a);
    if (da >= 0 !== db >= 0) output.push(interpolate(a, b, da / (da - db)));
  }
  return output;
}
/** Three fitted garment groups share the body's skeleton, including blended joint weights. */
export function createFittedClothing(
  body: SkinnedMesh,
  colors: readonly [string, string, string],
  patterned: boolean,
  cut: TopCut = "tee",
) {
  let geometry = cache.get(body.geometry)?.get(cut);
  if (!geometry) {
    const source = body.geometry,
      p = source.getAttribute("position"),
      n = source.getAttribute("normal"),
      uv = source.getAttribute("uv"),
      skin = source.getAttribute("skinIndex"),
      weights = source.getAttribute("skinWeight");
    const groups: Vertex[][] = [[], [], []];

    const vertex = (i: number): Vertex => {
      const bones = new Map<number, number>();
      for (let j = 0; j < 4; j++) {
        const bone = skin.getComponent(i, j),
          weight = weights.getComponent(i, j);
        if (
          Number.isInteger(bone) &&
          bone >= 0 &&
          bone < body.skeleton.bones.length &&
          Number.isFinite(weight) &&
          weight > 0
        )
          bones.set(bone, (bones.get(bone) ?? 0) + weight);
      }
      return {
        p: [p.getX(i), p.getY(i), p.getZ(i)],
        n: [n.getX(i), n.getY(i), n.getZ(i)],
        uv: [uv.getX(i), uv.getY(i)],
        bones,
      };
    };
    const add = (polygon: Vertex[], group: number) => {
      for (let i = 1; i < polygon.length - 1; i++)
        groups[group]!.push(polygon[0]!, polygon[i]!, polygon[i + 1]!);
    };
    for (let i = 0; i < p.count; i += 3) {
      const tri = [vertex(i), vertex(i + 1), vertex(i + 2)];
      let armWeight = 0;
      for (const v of tri)
        for (const [bone, w] of v.bones)
          if (armBones.has(body.skeleton.bones[bone]?.name ?? "")) armWeight += w / 3;
      const arm = armWeight > ARM_WEIGHT_THRESHOLD;
      let shirt = clip(tri, (v) => v.p[1]! - shirtLowerBoundary(arm, cut));
      shirt = clip(shirt, (v) => collarBoundary(v.p[0]!) - v.p[1]!);
      add(shirt, 0);
      if (!arm) {
        add(
          clip(
            clip(tri, (v) => GARMENT_FIT.waist - v.p[1]!),
            (v) => v.p[1]! - GARMENT_FIT.shoeTop,
          ),
          1,
        );
        add(
          clip(tri, (v) => GARMENT_FIT.shoeTop - v.p[1]!),
          2,
        );
      }
    }
    const positions: number[] = [],
      normals: number[] = [],
      uvs: number[] = [],
      indices: number[] = [],
      skinWeights: number[] = [];
    geometry = new BufferGeometry();
    let start = 0;
    for (let group = 0; group < groups.length; group++) {
      for (const v of groups[group]!) {
        const normal = new Vector3(...(v.n as [number, number, number])).normalize();
        // Give the basic outfit a fabric silhouette rather than skin-tight paint.
        // Keep the clearance small enough for the shared skeleton and mobile camera.
        const ease =
          group === 0
            ? GARMENT_FIT.clearance.top
            : group === 1
              ? GARMENT_FIT.clearance.bottom
              : GARMENT_FIT.clearance.shoes;
        const hemFlare = group === 0 && v.p[1]! < 0.56 ? 0.004 : 0;
        positions.push(
          v.p[0]! + normal.x * (ease + hemFlare),
          v.p[1]! + normal.y * ease,
          v.p[2]! + normal.z * (ease + hemFlare),
        );
        normals.push(...normal.toArray());
        uvs.push(...v.uv);
        const influence = [...v.bones].sort((a, b) => b[1] - a[1]).slice(0, 4),
          total = influence.reduce((sum, [, w]) => sum + w, 0);
        const validWeights = Number.isFinite(total) && total > 0;
        for (let j = 0; j < 4; j++) {
          indices.push(validWeights ? (influence[j]?.[0] ?? 0) : 0);
          skinWeights.push(validWeights ? (influence[j]?.[1] ?? 0) / total : j === 0 ? 1 : 0);
        }
      }
      geometry.addGroup(start, groups[group]!.length, group);
      start += groups[group]!.length;
    }
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const variants = cache.get(source) ?? new Map<TopCut, BufferGeometry>();
    variants.set(cut, geometry);
    cache.set(source, variants);
  }
  const materials = colors.map(
    (color, i) =>
      new MeshStandardMaterial({
        color,
        roughness: i === 2 ? 0.72 : 0.96,
        side: 2,
        map: i === 0 && patterned ? adireTexture() : null,
      }),
  );
  const mesh = new SkinnedMesh(geometry, materials);
  mesh.name = "fitted-character-outfit";
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = CHARACTER_GROUND.castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

const exposedCache = new WeakMap<BufferGeometry, Map<TopCut, BufferGeometry>>();
/** Avoid drawing a second full body underneath the fitted outfit. */
export function createVisibleSkin(body: SkinnedMesh, cut: TopCut = "tee") {
  let geometry = exposedCache.get(body.geometry)?.get(cut);
  if (!geometry) {
    const source = body.geometry,
      p = source.getAttribute("position"),
      skin = source.getAttribute("skinIndex"),
      weights = source.getAttribute("skinWeight"),
      indices: number[] = [];

    for (let i = 0; i < p.count; i += 3) {
      let armWeight = 0;
      for (let v = i; v < i + 3; v++)
        for (let j = 0; j < 4; j++)
          if (armBones.has(body.skeleton.bones[skin.getComponent(v, j)]?.name ?? "")) {
            const weight = weights.getComponent(v, j);
            if (Number.isFinite(weight) && weight > 0) armWeight += weight / 3;
          }
      const arm = armWeight > ARM_WEIGHT_THRESHOLD;
      const covered = [i, i + 1, i + 2].every((v) => {
        const y = p.getY(v),
          x = p.getX(v);
        return (
          (!arm && y <= GARMENT_FIT.waist) ||
          (y >= shirtLowerBoundary(arm, cut) && y <= collarBoundary(x))
        );
      });
      if (!covered) indices.push(i, i + 1, i + 2);
    }
    geometry = new BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes))
      geometry.setAttribute(name, attribute);
    geometry.setIndex(indices);
    const variants = exposedCache.get(source) ?? new Map<TopCut, BufferGeometry>();
    variants.set(cut, geometry);
    exposedCache.set(source, variants);
  }
  const mesh = new SkinnedMesh(geometry, body.material);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = CHARACTER_GROUND.castShadow;
  mesh.receiveShadow = true;
  return mesh;
}
