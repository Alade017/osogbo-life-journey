import {
  WorldInstances,
  WorldRoadMarkings,
  WorldRoads,
  WorldSidewalks,
  WorldStreetLights,
  type WorldInstance,
} from "@/components/3d/WorldScene";
import { WORLD_SCALE } from "@/components/3d/world-theme";
import { CanvasTexture, InstancedMesh, Object3D, SRGBColorSpace } from "three";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { roadRect, type DistrictLayout, type DistrictRect } from "@/game/districts/district-layout";
import { InstancedParts } from "@/components/district/district-kit";
import { DistrictWalker } from "@/components/district/DistrictWalker";
import { districtParts, type ShopSign } from "@/components/district/district-builders";

// Renders one compact district (300-600 m square) from its layout. World units are metres, so
// every position below is the layout's metre value. Repeated props use InstancedMesh (via the
// world components and district-kit), so the draw-call count stays low on phones.

const STREET_SIZE = WORLD_SCALE.neighborhoodStreetCell;
const LAMP_SPACING_M = 40;
const DASH_SPACING_M = 6;
const FENCE_H = 1.3;

function rectItem(rect: DistrictRect, y: number, h: number): WorldInstance {
  return { position: [rect.x, y, rect.z], scale: [rect.w, h, rect.d] };
}

/** Lamps every 40 m on both kerbs of each road. */
function lampPositions(layout: DistrictLayout): [number, number][] {
  const half = layout.sizeM / 2 - 8;
  const out: [number, number][] = [];
  for (const road of layout.roads) {
    for (let s = -half; s <= half; s += LAMP_SPACING_M) {
      const side = road.widthM / 2 + 1.2;
      if (road.axis === "horizontal") {
        out.push([s, road.offsetM - side], [s, road.offsetM + side]);
      } else {
        out.push([road.offsetM - side, s], [road.offsetM + side, s]);
      }
    }
  }
  return out;
}

/** Thin fence boxes around a yard's four sides, with one gap for the gate. */
function fenceItems(rect: DistrictRect): WorldInstance[] {
  const t = 0.16;
  const y = FENCE_H / 2;
  return [
    { position: [rect.x, y, rect.z - rect.d / 2], scale: [rect.w, FENCE_H, t] },
    { position: [rect.x, y, rect.z + rect.d / 2], scale: [rect.w, FENCE_H, t] },
    { position: [rect.x - rect.w / 2, y, rect.z], scale: [t, FENCE_H, rect.d] },
    { position: [rect.x + rect.w / 2, y, rect.z], scale: [t, FENCE_H, rect.d] },
  ];
}

const STALL_COLORS = ["#c94b36", "#e3b542", "#43845c"] as const;

/** Splits each open-front kiosk strip into individual 3.4 m stalls, each with a canopy. */
function kioskStalls(rects: readonly DistrictRect[]) {
  const stalls: { color: number; body: WorldInstance; canopy: WorldInstance }[] = [];
  for (const r of rects) {
    const horizontal = r.w >= r.d;
    const length = horizontal ? r.w : r.d;
    const count = Math.max(1, Math.floor(length / 4.4));
    for (let i = 0; i < count; i += 1) {
      const along = -length / 2 + 2.2 + i * 4.4;
      const x = horizontal ? r.x + along : r.x;
      const z = horizontal ? r.z : r.z + along;
      const color = stalls.length % STALL_COLORS.length;
      stalls.push({
        color,
        body: {
          position: [x, 1.1, z],
          scale: horizontal ? [3.4, 2.2, r.d] : [r.w, 2.2, 3.4],
        },
        canopy: {
          position: [x, 2.3, z],
          scale: horizontal ? [3.6, 0.25, r.d + 0.6] : [r.w + 0.6, 0.25, 3.6],
        },
      });
    }
  }
  return stalls;
}

const BILLBOARDS = [
  { x: -48, z: -48, yaw: Math.PI / 4, label: "OSOGBO LIFE", sub: "Live your Osogbo story" },
  {
    x: 48,
    z: 48,
    yaw: -(3 * Math.PI) / 4,
    label: "OLAIYA JUNCTION",
    sub: "Everything on one street",
  },
] as const;

/** A steel-framed billboard with a painted sign face, facing the junction. */
function BillboardFace({
  x,
  z,
  yaw,
  label,
  sub,
}: {
  x: number;
  z: number;
  yaw: number;
  label: string;
  sub: string;
}) {
  const face = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1f5f9a";
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(0, 196, 512, 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 72px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, 256, 116);
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#f7f1df";
      ctx.fillText(sub, 256, 176);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [label, sub]);

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[0.35, 14, 0.35]} />
        <meshStandardMaterial color="#9aa3ad" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 13.5, 0.1]} castShadow>
        <boxGeometry args={[11.6, 6.6, 0.4]} />
        <meshStandardMaterial color="#5b636c" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 13.5, 0.33]}>
        <planeGeometry args={[11, 6]} />
        <meshStandardMaterial map={face} roughness={0.7} />
      </mesh>
    </group>
  );
}

const SIGN_BACKGROUNDS = ["#1f5f9a", "#c94b36", "#43845c", "#e3b542"] as const;

/** A shopfront sign: the business name painted on a canvas, on a coloured board. */
function signTexture(name: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  const background = SIGN_BACKGROUNDS[name.length % SIGN_BACKGROUNDS.length] ?? SIGN_BACKGROUNDS[0];
  if (ctx) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = background === "#e3b542" ? "#1d1d1b" : "#ffffff";
    ctx.font = "bold 84px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 512, 84, 960);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** One instanced mesh per distinct business name, so each sign type costs one draw call. */
function SignBatch({ name, signs }: { name: string; signs: readonly ShopSign[] }) {
  const texture = useMemo(() => signTexture(name), [name]);
  useEffect(() => () => texture.dispose(), [texture]);
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const object = new Object3D();
    signs.forEach((sign, i) => {
      object.position.set(sign.x, sign.y, sign.z);
      object.scale.set(sign.w, sign.h, 1);
      object.updateMatrix();
      target.setMatrixAt(i, object.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [signs]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, signs.length]}>
      <planeGeometry />
      <meshStandardMaterial map={texture} roughness={0.7} />
    </instancedMesh>
  );
}

function ShopSigns({ signs }: { signs: readonly ShopSign[] }) {
  const groups = useMemo(() => {
    const byName = new Map<string, ShopSign[]>();
    for (const sign of signs) {
      const list = byName.get(sign.name) ?? [];
      list.push(sign);
      byName.set(sign.name, list);
    }
    return [...byName];
  }, [signs]);
  return (
    <>
      {groups.map(([name, list]) => (
        <SignBatch key={name} name={name} signs={list} />
      ))}
    </>
  );
}

export function DistrictScene({
  layout,
  walkable = false,
}: {
  layout: DistrictLayout;
  /** Adds a playable walker with a follow camera. Off by default, so static previews stay as they are. */
  walkable?: boolean;
}) {
  const size = layout.sizeM;
  const parts = useMemo(() => districtParts(layout), [layout]);
  const medians = layout.roads
    .filter((road) => road.kind === "arterial")
    .map((road) => rectItem(roadRect(road, size), 0.07, 0.04));
  const roads = layout.roads.map((road) => rectItem(roadRect(road, size), 0.03, 0.06));
  const markings: WorldInstance[] = [];
  for (const road of layout.roads) {
    if (road.kind !== "arterial") continue;
    const rect = roadRect(road, size);
    for (let s = -size / 2 + DASH_SPACING_M; s < size / 2; s += DASH_SPACING_M) {
      markings.push(
        road.axis === "horizontal"
          ? { position: [s, 0.07, rect.z], scale: [3, 0.02, 0.25] }
          : { position: [rect.x, 0.07, s], scale: [0.25, 0.02, 3] },
      );
    }
  }
  const sidewalks: WorldInstance[] = [];
  for (const road of layout.roads) {
    for (const sign of [-1, 1]) {
      const offset = road.offsetM + sign * (road.widthM / 2 + 1.5);
      sidewalks.push(
        road.axis === "horizontal"
          ? { position: [0, 0.1, offset], scale: [size, 0.2, 3] }
          : { position: [offset, 0.1, 0], scale: [3, 0.2, size] },
      );
    }
  }
  const curbs: WorldInstance[] = sidewalks.map((item) => ({
    position: [item.position[0], 0.02, item.position[2]],
    scale: [item.scale?.[0] ?? 1, 0.04, item.scale?.[2] ?? 1],
  }));

  const yards = layout.yards.filter((y) => y.kind === "yard");
  const kiosks = layout.yards.filter((y) => y.kind === "kiosk-row");
  const stalls = kioskStalls(kiosks);

  const exitPosts: WorldInstance[] = layout.exits.map((exit) => {
    const half = size / 2;
    const [x, z] =
      exit.edge === "north"
        ? [exit.offsetM, -half + 2]
        : exit.edge === "south"
          ? [exit.offsetM, half - 2]
          : exit.edge === "east"
            ? [half - 2, exit.offsetM]
            : [-half + 2, exit.offsetM];
    return { position: [x, 2.5, z], scale: [1.2, 5, 1.2] };
  });

  return (
    <group>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#d8cba9" roughness={0.95} />
      </mesh>
      <WorldInstances
        items={yards.map((y) => rectItem(y, 0.04, 0.05))}
        tone="clay"
        castShadow={false}
      />
      <WorldInstances items={yards.flatMap(fenceItems)} tone="wall" />
      <fog attach="fog" args={["#e9e2cf", 90, 380]} />
      <WorldRoads items={roads} />
      {/* Grass medians down the arterials, as on the Lagos avenues in the reference. */}
      <WorldInstances
        items={layout.roads
          .filter((road) => road.kind === "arterial")
          .map((road) => {
            const r = roadRect(road, size);
            return road.axis === "horizontal"
              ? {
                  position: [0, 0.09, r.z] as [number, number, number],
                  scale: [size, 0.12, 1.6] as [number, number, number],
                }
              : {
                  position: [r.x, 0.09, 0] as [number, number, number],
                  scale: [1.6, 0.12, size] as [number, number, number],
                };
          })}
        tone="foliage"
        castShadow={false}
      />
      <WorldRoadMarkings items={markings} />
      <WorldSidewalks sidewalks={sidewalks} curbs={curbs} />
      <WorldStreetLights positions={lampPositions(layout)} size={STREET_SIZE} />
      {/* Houses and shop blocks: varied walls, roofs, windows, awnings and signboards. */}
      <InstancedParts parts={parts.buildings} castShadow />
      {/* Shaped yellow danfo minibuses (cab, windscreen, wheels, headlights). */}
      <InstancedParts parts={parts.vehicles} />
      {/* Market pitches with umbrellas and crates, parking bays, and shrub beds. */}
      <InstancedParts parts={parts.spares} />
      {/* Gutters, parked cars, keke tricycles, bus shelters, bins and zebra crossings. */}
      <InstancedParts parts={parts.street} />
      <ShopSigns signs={parts.signs} />
      {STALL_COLORS.map((color, c) => {
        const group = stalls.filter((st) => st.color === c);
        return (
          <group key={`stall-${c}`}>
            <WorldInstances items={group.map((st) => st.body)} tone="wall" color={color} />
            <WorldInstances items={group.map((st) => st.canopy)} tone="linen" />
          </group>
        );
      })}
      <WorldInstances
        items={layout.places.filter((p) => p.kind === "kiosk").map((p) => rectItem(p, 0, 2.4))}
        tone="accent"
      />
      <WorldInstances items={layout.doors.map((d) => rectItem(d, 0, 2.6))} tone="wall" />
      <WorldInstances items={exitPosts} tone="indigo" />
      {BILLBOARDS.map((b, i) => (
        <BillboardFace key={`billboard-${i}`} {...b} />
      ))}
      <InstancedParts parts={parts.trees} />
      {walkable ? <DistrictWalker layout={layout} /> : null}
    </group>
  );
}
