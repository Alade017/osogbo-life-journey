import type { DistrictLayout, DistrictRect } from "@/game/districts/district-layout";

// Client-side walking for one district: collision against the district's solid footprints, and
// a sliding move so the player slides along walls instead of stopping dead. Pure functions, so
// they are unit tested and can later be checked against the server-authoritative movement rules.

export interface Solid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Walker collision radius in metres (a person's shoulder width). */
export const WALKER_RADIUS_M = 0.4;
/** Trunk footprint for a tree, in metres (half-width). */
const TREE_HALF_M = 1.2;
/** Walkers start on the junction road, clear of every building. */
export const WALKER_SPAWN = { x: 0, z: 3 } as const;

function rectSolid(r: DistrictRect): Solid {
  return {
    minX: r.x - r.w / 2,
    maxX: r.x + r.w / 2,
    minZ: r.z - r.d / 2,
    maxZ: r.z + r.d / 2,
  };
}

/**
 * Everything a walker cannot pass: every lot (houses and their yards), every shop, door and kiosk
 * row, fenced yards, and tree trunks. Roads, sidewalks, spare market and parking ground, and the
 * open gaps between them stay walkable.
 */
export function solidsFor(layout: DistrictLayout): Solid[] {
  const solids: Solid[] = [];
  for (const lot of layout.lots) solids.push(rectSolid(lot));
  for (const place of layout.places) solids.push(rectSolid(place));
  for (const door of layout.doors) solids.push(rectSolid(door));
  for (const yard of layout.yards) {
    if (yard.kind === "yard" || yard.kind === "kiosk-row") solids.push(rectSolid(yard));
  }
  for (const tree of layout.trees) {
    solids.push({
      minX: tree.x - TREE_HALF_M,
      maxX: tree.x + TREE_HALF_M,
      minZ: tree.z - TREE_HALF_M,
      maxZ: tree.z + TREE_HALF_M,
    });
  }
  return solids;
}

/** True if a walker circle at (x, z) overlaps any solid. */
export function blocked(
  x: number,
  z: number,
  solids: readonly Solid[],
  radius = WALKER_RADIUS_M,
): boolean {
  for (const s of solids) {
    const nx = Math.min(Math.max(x, s.minX), s.maxX);
    const nz = Math.min(Math.max(z, s.minZ), s.maxZ);
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/**
 * Moves a walker by (dx, dz) metres. Movement is split into small steps and each axis is tried
 * separately, so a walker pressed diagonally against a wall slides along it. The walker stays
 * inside the district, one metre in from the edge.
 */
export function moveWalker(
  pos: { x: number; z: number },
  dx: number,
  dz: number,
  solids: readonly Solid[],
  halfM: number,
): { x: number; z: number } {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  const sx = dx / steps;
  const sz = dz / steps;
  let { x, z } = pos;
  const limit = halfM - 1;
  for (let i = 0; i < steps; i += 1) {
    if (!blocked(x + sx, z, solids)) x += sx;
    if (!blocked(x, z + sz, solids)) z += sz;
    x = Math.min(Math.max(x, -limit), limit);
    z = Math.min(Math.max(z, -limit), limit);
  }
  return { x, z };
}

/** Keys currently held: movement is relative to the camera; turn keys orbit the camera. */
export interface WalkInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Converts held keys into a metre offset for this frame, relative to the camera's yaw. The camera
 * sits behind the player at (sin yaw, cos yaw) times its distance, so "forward" points away from
 * it. Diagonal input is normalised so moving diagonally is not faster.
 */
export function moveFromInput(
  input: WalkInput,
  camYaw: number,
  distM: number,
): { dx: number; dz: number } {
  const iz = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (iz === 0 && ix === 0) return { dx: 0, dz: 0 };
  // Forward f = (-sin, -cos); right r = (cos, -sin).
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = -Math.sin(camYaw);
  let dx = fx * iz + rx * ix;
  let dz = fz * iz + rz * ix;
  const len = Math.hypot(dx, dz);
  dx = (dx / len) * distM;
  dz = (dz / len) * distM;
  return { dx, dz };
}

/** Interpolates between two angles along the shortest arc. */
export function lerpAngle(from: number, to: number, t: number): number {
  const TAU = Math.PI * 2;
  const delta = ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return from + delta * t;
}
