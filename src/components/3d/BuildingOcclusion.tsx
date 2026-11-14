import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, Material, MeshStandardMaterial, Raycaster, Scene, Vector3 } from "three";
import {
  approachOpacity,
  OCCLUDED_OPACITY,
  occlusionStyleFor,
} from "@/components/3d/building-occlusion";

type Occluder = { root: Group; meshes: Mesh[] };

const scratchDirection = new Vector3();
const scratchSubject = new Vector3();

function coarsePointer(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * Hides or fades any building (a group tagged `userData.occluder`) that stands between the
 * camera and the subject. Phones cut the building away; laptops fade it.
 */
export function BuildingOcclusion({ subject }: { subject: readonly [number, number, number] }) {
  const { camera, scene, invalidate } = useThree();
  const style = useMemo(() => occlusionStyleFor({ coarsePointer: coarsePointer() }), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const occluders = useRef<Occluder[]>([]);
  const frame = useRef(0);

  useFrame((_, delta) => {
    frame.current += 1;
    if (frame.current % 30 === 1) {
      occluders.current = collectOccluders(scene);
    }
    if (!occluders.current.length) return;

    scratchSubject.set(subject[0], subject[1], subject[2]);
    scratchDirection.copy(scratchSubject).sub(camera.position);
    const distance = scratchDirection.length();
    raycaster.set(camera.position, scratchDirection.normalize());
    raycaster.far = Math.max(0, distance - 0.4);
    const hits = raycaster.intersectObjects(
      occluders.current.map((item) => item.root),
      true,
    );
    const blocked = new Set<Group>();
    for (const hit of hits) {
      let node = hit.object.parent;
      while (node && !(node.userData["occluder"] && node instanceof Group)) node = node.parent;
      if (node) blocked.add(node as Group);
    }

    let changed = false;
    for (const { root, meshes } of occluders.current) {
      const isBlocked = blocked.has(root);
      if (style === "cutaway") {
        if (root.visible === isBlocked) {
          root.visible = !isBlocked;
          changed = true;
        }
        continue;
      }
      for (const mesh of meshes) {
        for (const material of fadeMaterials(mesh)) {
          const target = isBlocked ? OCCLUDED_OPACITY : 1;
          const next = approachOpacity(material.opacity, target, delta);
          if (Math.abs(next - material.opacity) > 0.001) changed = true;
          material.opacity = Math.abs(next - target) < 0.01 ? target : next;
        }
      }
    }
    if (changed) invalidate();
  });

  return null;
}

function collectOccluders(scene: Scene): Occluder[] {
  const found: Occluder[] = [];
  scene.traverse((object) => {
    if (object instanceof Group && object.userData["occluder"]) {
      const meshes: Mesh[] = [];
      object.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child);
      });
      found.push({ root: object, meshes });
    }
  });
  return found;
}

/** Each mesh gets its own transparent material copies, so fading never touches other buildings. */
function fadeMaterials(mesh: Mesh): MeshStandardMaterial[] {
  const existing = mesh.userData["fadeMaterials"] as MeshStandardMaterial[] | undefined;
  if (existing) return existing;
  const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const copies = source.map((material: Material) => {
    const copy = (material as MeshStandardMaterial).clone();
    copy.transparent = true;
    copy.depthWrite = true;
    return copy;
  });
  mesh.material = Array.isArray(mesh.material) ? copies : copies[0]!;
  mesh.userData["fadeMaterials"] = copies;
  return copies;
}

/** Smoothly fades out and hides roofs/upper stories when the player walks inside an interior footprint. */
export function useInteriorRoofFade(inside: boolean) {
  const { invalidate } = useThree();
  const groupRef = useRef<Group>(null);
  const opacityRef = useRef(1);
  const materialsRef = useRef<MeshStandardMaterial[]>([]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (materialsRef.current.length === 0) {
      const mats: MeshStandardMaterial[] = [];
      group.traverse((child) => {
        if ("isMesh" in child && child.isMesh) {
          const mat = (child as { material?: MeshStandardMaterial | MeshStandardMaterial[] })
            .material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              m.transparent = true;
              mats.push(m);
            });
          } else if (mat) {
            mat.transparent = true;
            mats.push(mat);
          }
        }
      });
      materialsRef.current = mats;
    }

    const target = inside ? 0 : 1;
    const current = opacityRef.current;
    if (Math.abs(current - target) < 0.015) {
      if (current !== target) {
        opacityRef.current = target;
        materialsRef.current.forEach((m) => {
          m.opacity = target;
          m.depthWrite = target > 0.5;
        });
        group.visible = target > 0.05;
        invalidate();
      }
      return;
    }

    const next = approachOpacity(current, target, Math.min(delta, 0.1), 12);
    opacityRef.current = next;
    materialsRef.current.forEach((m) => {
      m.opacity = next;
      m.depthWrite = next > 0.5;
    });
    group.visible = next > 0.05;
    invalidate();
  });

  return groupRef;
}
