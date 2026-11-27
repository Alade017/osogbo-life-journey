import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  SphereGeometry,
} from "three";
import type { GeoKind, Part } from "@/components/district/district-builders";

// Renders coloured parts with one InstancedMesh per primitive kind, so a district with hundreds
// of houses, buses and umbrellas still costs only a handful of draw calls on phones.

const KINDS: readonly GeoKind[] = ["box", "cylinder", "cone", "sphere", "gable", "hip"];

/** A triangular prism with its ridge along local x: a pitched roof, base at y 0, apex at y 1. */
function gableGeometry(): BufferGeometry {
  const x0 = -0.5;
  const x1 = 0.5;
  const tris = [
    // End gables.
    [x0, 0, -0.5, x0, 0, 0.5, x0, 1, 0],
    [x1, 0, -0.5, x1, 1, 0, x1, 0, 0.5],
    // Slopes.
    [x0, 0, -0.5, x1, 1, 0, x1, 0, -0.5],
    [x0, 0, -0.5, x0, 1, 0, x1, 1, 0],
    [x0, 0, 0.5, x1, 0, 0.5, x1, 1, 0],
    [x0, 0, 0.5, x1, 1, 0, x0, 1, 0],
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(tris.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A hip roof: four sloping faces meeting a short ridge along local x, base at y 0, apex at y 1. */
function hipGeometry(): BufferGeometry {
  const A = [-0.5, 0, -0.5];
  const B = [0.5, 0, -0.5];
  const C = [0.5, 0, 0.5];
  const D = [-0.5, 0, 0.5];
  const R1 = [-0.25, 1, 0];
  const R2 = [0.25, 1, 0];
  const tris = [
    [...A, ...B, ...R2],
    [...A, ...R2, ...R1],
    [...D, ...C, ...R2],
    [...D, ...R2, ...R1],
    [...A, ...D, ...R1],
    [...B, ...C, ...R2],
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(tris.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

let cachedGeometries: Record<GeoKind, BufferGeometry> | null = null;

/** Shared unit geometries, created once and scaled per instance. */
function geometries(): Record<GeoKind, BufferGeometry> {
  cachedGeometries ??= {
    box: new BoxGeometry(1, 1, 1),
    cylinder: new CylinderGeometry(1, 1, 1, 10),
    cone: new ConeGeometry(1, 1, 8),
    sphere: new SphereGeometry(1, 8, 6),
    gable: gableGeometry(),
    hip: hipGeometry(),
  };
  return cachedGeometries;
}

function PartBatch({
  geometry,
  parts,
  castShadow,
}: {
  geometry: BufferGeometry;
  parts: readonly Part[];
  castShadow: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const object = new Object3D();
    object.rotation.order = "YXZ";
    const color = new Color();
    parts.forEach((part, index) => {
      object.position.set(...part.position);
      object.scale.set(...part.scale);
      object.rotation.set(part.pitch ?? 0, part.yaw ?? 0, 0);
      object.updateMatrix();
      target.setMatrixAt(index, object.matrix);
      target.setColorAt(index, color.set(part.color));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [parts]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, parts.length]}
      castShadow={castShadow}
      receiveShadow
    >
      <meshStandardMaterial roughness={0.85} side={DoubleSide} />
    </instancedMesh>
  );
}

/** All parts in a list, batched by primitive kind (at most one draw call per kind). */
export function InstancedParts({
  parts,
  castShadow = false,
}: {
  parts: readonly Part[];
  castShadow?: boolean;
}) {
  const groups = useMemo(() => {
    const byKind: Partial<Record<GeoKind, Part[]>> = {};
    for (const part of parts) {
      (byKind[part.kind] ??= []).push(part);
    }
    return byKind;
  }, [parts]);
  const shared = geometries();
  return (
    <>
      {KINDS.map((kind) => {
        const group = groups[kind];
        if (!group?.length) return null;
        return (
          <PartBatch key={kind} geometry={shared[kind]} parts={group} castShadow={castShadow} />
        );
      })}
    </>
  );
}
