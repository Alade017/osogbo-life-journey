import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Object3D, type InstancedMesh } from "three";
import type { PerimeterSpec } from "@/game/neighborhood-zones";
import { WORLD_PALETTE, WORLD_SCALE } from "./world-theme";

const LATERITE_ROOF = "#a44a32";
const SILVER_ROOF = "#b8c0c8";

interface MatrixItem {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rx?: number;
  ry?: number;
  rz?: number;
  color?: string;
}

function InstancedBoxLayer({
  items,
  color,
  roughness = 0.88,
  metalness = 0.04,
  castShadow = true,
  receiveShadow = true,
}: {
  items: readonly MatrixItem[];
  color: string;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const hasPerInstanceColor = useMemo(
    () => items.some((item) => item.color !== undefined),
    [items],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || items.length === 0) return;
    const dummy = new Object3D();
    const scratchColor = new Color();

    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (hasPerInstanceColor) {
        scratchColor.set(item.color ?? color);
        mesh.setColorAt(index, scratchColor);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (hasPerInstanceColor && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [color, hasPerInstanceColor, items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      raycast={() => null}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={hasPerInstanceColor ? "#ffffff" : color}
        roughness={roughness}
        metalness={metalness}
        flatShading
      />
    </instancedMesh>
  );
}

function InstancedSphereLayer({
  items,
  color,
  roughness = 0.92,
}: {
  items: readonly MatrixItem[];
  color: string;
  roughness?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const hasPerInstanceColor = useMemo(
    () => items.some((item) => item.color !== undefined),
    [items],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || items.length === 0) return;
    const dummy = new Object3D();
    const scratchColor = new Color();

    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (hasPerInstanceColor) {
        scratchColor.set(item.color ?? color);
        mesh.setColorAt(index, scratchColor);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (hasPerInstanceColor && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [color, hasPerInstanceColor, items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow
      receiveShadow
      raycast={() => null}
    >
      <icosahedronGeometry args={[0.5, 1]} />
      <meshStandardMaterial
        color={hasPerInstanceColor ? "#ffffff" : color}
        roughness={roughness}
        metalness={0}
        flatShading
      />
    </instancedMesh>
  );
}

export function NeighborhoodPerimeter({
  perimeter,
  point,
}: {
  perimeter: PerimeterSpec;
  point: (x: number, y: number) => [number, number, number];
}) {
  const unit = WORLD_SCALE.neighborhoodUnit;

  const layers = useMemo(() => {
    const foundations: MatrixItem[] = [];
    const bodies: MatrixItem[] = [];
    const roofs: MatrixItem[] = [];
    const roofGables: MatrixItem[] = [];
    const doors: MatrixItem[] = [];
    const windows: MatrixItem[] = [];
    const compoundWalls: MatrixItem[] = [];
    const compoundCaps: MatrixItem[] = [];
    const palmTrunks: MatrixItem[] = [];
    const palmFronds: MatrixItem[] = [];
    const neemTrunks: MatrixItem[] = [];
    const neemCanopies: MatrixItem[] = [];
    const poles: MatrixItem[] = [];
    const crossarms: MatrixItem[] = [];
    const insulators: MatrixItem[] = [];
    const wires: MatrixItem[] = [];

    // 1. Instanced 1- and 2-story Nigerian residential buildings
    for (const b of perimeter.buildings) {
      const [wx, , wz] = point(b.x, b.y);
      const rot = (b.rotationQuarterTurns * Math.PI) / 2;
      const w = b.width * unit;
      const d = b.height * unit;
      const storyH = b.stories === 2 ? 5.15 : 2.95;
      const roofColor = b.roofVariant === "laterite" ? LATERITE_ROOF : SILVER_ROOF;

      foundations.push({ x: wx, y: 0.1, z: wz, sx: w + 0.18, sy: 0.2, sz: d + 0.18, ry: rot });
      bodies.push({
        x: wx,
        y: 0.2 + storyH / 2,
        z: wz,
        sx: w,
        sy: storyH,
        sz: d,
        ry: rot,
        color: b.wallColor,
      });

      // Pitched roof slopes rotated with the building's 90-degree orientation
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const localToWorld = (lx: number, lz: number): [number, number] => [
        wx + lx * cosR + lz * sinR,
        wz - lx * sinR + lz * cosR,
      ];

      const slopeWidth = w * 0.54;
      const roofY = 0.2 + storyH + 0.32;
      const [leftX, leftZ] = localToWorld(-w * 0.24, 0);
      const [rightX, rightZ] = localToWorld(w * 0.24, 0);

      // Rotate slope around local Z (which maps to world Z or X depending on quarter turn)
      roofs.push(
        {
          x: leftX,
          y: roofY,
          z: leftZ,
          sx: slopeWidth,
          sy: 0.12,
          sz: d + 0.34,
          ry: rot,
          rz: 0.36,
          color: roofColor,
        },
        {
          x: rightX,
          y: roofY,
          z: rightZ,
          sx: slopeWidth,
          sy: 0.12,
          sz: d + 0.34,
          ry: rot,
          rz: -0.36,
          color: roofColor,
        },
      );

      // Ridge beam cap
      roofGables.push({
        x: wx,
        y: 0.2 + storyH + 0.55,
        z: wz,
        sx: 0.18,
        sy: 0.12,
        sz: d + 0.36,
        ry: rot,
        color: roofColor,
      });

      // Front door & floor windows
      const [doorX, doorZ] = localToWorld(0, d / 2 + 0.03);
      doors.push({ x: doorX, y: 1.15, z: doorZ, sx: 0.9, sy: 1.9, sz: 0.08, ry: rot });

      const floorHeights = b.stories === 2 ? [1.65, 3.85] : [1.65];
      for (const fh of floorHeights) {
        for (const side of [-1, 1]) {
          const [winX, winZ] = localToWorld(side * w * 0.3, d / 2 + 0.03);
          windows.push({ x: winX, y: fh, z: winZ, sx: 0.72, sy: 0.78, sz: 0.07, ry: rot });
        }
      }
    }

    // 2. Concrete compound perimeter walls & pillar caps
    for (const wall of perimeter.walls) {
      const [wx, , wz] = point(wall.x, wall.y);
      const ww = wall.width * unit;
      const wd = wall.height * unit;
      compoundWalls.push({ x: wx, y: 0.85, z: wz, sx: ww, sy: 1.7, sz: wd });
      compoundCaps.push({ x: wx, y: 1.74, z: wz, sx: ww + 0.08, sy: 0.1, sz: wd + 0.08 });
    }

    // 3. Oil palm & neem tree clusters
    for (const tree of perimeter.trees) {
      const [tx, , tz] = point(tree.x, tree.y);
      const s = tree.scale;
      if (tree.species === "oil-palm") {
        // Tall segmented slightly-curved trunk
        for (let seg = 0; seg < 4; seg += 1) {
          const lean = seg * 0.09 * s;
          palmTrunks.push({
            x: tx + Math.cos(tree.rotation) * lean,
            y: (seg + 0.5) * 1.12 * s,
            z: tz + Math.sin(tree.rotation) * lean,
            sx: (0.28 - seg * 0.03) * s,
            sy: 1.18 * s,
            sz: (0.28 - seg * 0.03) * s,
            ry: tree.rotation,
          });
        }
        const crownX = tx + Math.cos(tree.rotation) * 0.3 * s;
        const crownY = 4.55 * s;
        const crownZ = tz + Math.sin(tree.rotation) * 0.3 * s;
        // 6 radiating palm fronds
        for (let f = 0; f < 6; f += 1) {
          const angle = tree.rotation + (f * Math.PI) / 3;
          palmFronds.push({
            x: crownX + Math.cos(angle) * 0.85 * s,
            y: crownY - 0.12 * s,
            z: crownZ + Math.sin(angle) * 0.85 * s,
            sx: 1.85 * s,
            sy: 0.14 * s,
            sz: 0.42 * s,
            ry: -angle,
            rz: -0.28,
            color: f % 2 === 0 ? "#4d7c4a" : "#5e8f56",
          });
        }
      } else {
        // Neem shade tree: stout trunk + layered broad canopy
        neemTrunks.push({
          x: tx,
          y: 1.15 * s,
          z: tz,
          sx: 0.32 * s,
          sy: 2.3 * s,
          sz: 0.32 * s,
        });
        neemCanopies.push(
          {
            x: tx,
            y: 2.85 * s,
            z: tz,
            sx: 2.3 * s,
            sy: 1.65 * s,
            sz: 2.3 * s,
            color: "#6b885b",
          },
          {
            x: tx + 0.45 * s,
            y: 2.45 * s,
            z: tz - 0.35 * s,
            sx: 1.55 * s,
            sy: 1.2 * s,
            sz: 1.55 * s,
            color: "#7c9868",
          },
        );
      }
    }

    // 4. Utility poles, crossarms, insulators, and overhead cable spans
    for (const pole of perimeter.poles) {
      const [px, , pz] = point(pole.x, pole.y);
      poles.push({ x: px, y: 2.3, z: pz, sx: 0.18, sy: 4.6, sz: 0.18, ry: pole.rotation });
      crossarms.push({ x: px, y: 4.35, z: pz, sx: 1.15, sy: 0.11, sz: 0.14, ry: pole.rotation });
      for (const offset of [-0.42, 0, 0.42]) {
        const ix = px + Math.cos(pole.rotation) * offset;
        const iz = pz - Math.sin(pole.rotation) * offset;
        insulators.push({ x: ix, y: 4.46, z: iz, sx: 0.08, sy: 0.14, sz: 0.08 });
      }
    }

    for (const span of perimeter.wireSpans) {
      const [sx, , sz] = point(span.start.x, span.start.y);
      const [ex, , ez] = point(span.end.x, span.end.y);
      const dx = ex - sx;
      const dz = ez - sz;
      const length = Math.hypot(dx, dz);
      if (length < 0.2) continue;
      const angle = Math.atan2(dz, dx);
      for (const offset of [-0.32, 0.32]) {
        const nx = (-dz / length) * offset;
        const nz = (dx / length) * offset;
        wires.push({
          x: (sx + ex) / 2 + nx,
          y: 4.42,
          z: (sz + ez) / 2 + nz,
          sx: length,
          sy: 0.025,
          sz: 0.025,
          ry: -angle,
        });
      }
    }

    return {
      foundations,
      bodies,
      roofs,
      roofGables,
      doors,
      windows,
      compoundWalls,
      compoundCaps,
      palmTrunks,
      palmFronds,
      neemTrunks,
      neemCanopies,
      poles,
      crossarms,
      insulators,
      wires,
    };
  }, [perimeter, point, unit]);

  return (
    <group name="neighborhood-perimeter">
      <InstancedBoxLayer
        items={layers.foundations}
        color={WORLD_PALETTE.concrete}
        castShadow={false}
      />
      <InstancedBoxLayer items={layers.bodies} color="#e8dcc6" />
      <InstancedBoxLayer
        items={layers.roofs}
        color={LATERITE_ROOF}
        roughness={0.68}
        metalness={0.18}
      />
      <InstancedBoxLayer
        items={layers.roofGables}
        color={LATERITE_ROOF}
        roughness={0.68}
        metalness={0.18}
      />
      <InstancedBoxLayer items={layers.doors} color={WORLD_PALETTE.door} castShadow={false} />
      <InstancedBoxLayer
        items={layers.windows}
        color={WORLD_PALETTE.glass}
        roughness={0.35}
        castShadow={false}
      />
      <InstancedBoxLayer items={layers.compoundWalls} color="#cfc4b2" />
      <InstancedBoxLayer items={layers.compoundCaps} color="#9e9689" castShadow={false} />
      <InstancedBoxLayer items={layers.palmTrunks} color="#7c6248" />
      <InstancedBoxLayer items={layers.palmFronds} color="#4d7c4a" />
      <InstancedBoxLayer items={layers.neemTrunks} color={WORLD_PALETTE.timber} />
      <InstancedSphereLayer items={layers.neemCanopies} color="#6b885b" />
      <InstancedBoxLayer items={layers.poles} color={WORLD_PALETTE.concrete} />
      <InstancedBoxLayer items={layers.crossarms} color={WORLD_PALETTE.timber} />
      <InstancedBoxLayer items={layers.insulators} color={WORLD_PALETTE.linen} castShadow={false} />
      <InstancedBoxLayer items={layers.wires} color="#283038" castShadow={false} />
    </group>
  );
}
