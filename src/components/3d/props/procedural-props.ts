import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WorldTone } from "../world-theme";

/** One merged piece of a prop, drawn with the scene's material for its tone. */
export type PropPart = { tone: WorldTone; geometry: BufferGeometry };

type Transform = {
  at?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
};

/** Builds a non-indexed copy of `geometry` placed by `transform`, so every part can be merged. */
function place(geometry: BufferGeometry, transform: Transform = {}): BufferGeometry {
  const { at = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = transform;
  const matrix = new Matrix4().compose(
    new Vector3(...at),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  );
  const copy = geometry.index ? geometry.toNonIndexed() : geometry;
  copy.applyMatrix4(matrix);
  return copy;
}

function part(tone: WorldTone, geometry: BufferGeometry, transform?: Transform): PropPart {
  return { tone, geometry: place(geometry, transform) };
}

/** Merges parts that share a tone, so each prop draws one mesh per material. */
export function mergeParts(parts: readonly PropPart[]): PropPart[] {
  const byTone = new Map<WorldTone, BufferGeometry[]>();
  for (const item of parts) {
    const list = byTone.get(item.tone) ?? [];
    list.push(item.geometry);
    byTone.set(item.tone, list);
  }
  return [...byTone.entries()].map(([tone, geometries]) => ({
    tone,
    geometry: geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false)!,
  }));
}

export function triangleCount(parts: readonly PropPart[]): number {
  return parts.reduce(
    (sum, item) => sum + (item.geometry.getAttribute("position")?.count ?? 0) / 3,
    0,
  );
}

/**
 * A tall palm: a tapering timber trunk with a crown of drooping fronds and a cluster of nuts.
 * Dimensions are in scene units; `height` is the trunk top.
 */
export function palmTreeParts({
  height,
  frondLength,
  frondCount = 8,
}: {
  height: number;
  frondLength: number;
  frondCount?: number;
}): PropPart[] {
  const parts: PropPart[] = [
    part("timber", new CylinderGeometry(height * 0.025, height * 0.045, height, 7), {
      at: [0, height / 2, 0],
    }),
  ];
  for (let index = 0; index < frondCount; index += 1) {
    const heading = (index / frondCount) * Math.PI * 2;
    // A flattened cone reads as a frond; it is tilted out and drooping, then turned to its heading.
    parts.push(
      part("foliage", new ConeGeometry(frondLength * 0.14, frondLength, 4), {
        at: [0, height, 0],
        rotation: [0, heading, 0],
        scale: [1, 1, 0.28],
      }),
    );
    parts.push(
      part("foliage", new ConeGeometry(frondLength * 0.14, frondLength * 0.9, 4), {
        at: [
          Math.sin(heading) * frondLength * 0.45,
          height - frondLength * 0.2,
          Math.cos(heading) * frondLength * 0.45,
        ],
        rotation: [0, heading, Math.PI / 2 - 0.35],
        scale: [1, 1, 0.28],
      }),
    );
  }
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    parts.push(
      part("timber", new SphereGeometry(height * 0.03, 6, 5), {
        at: [
          Math.cos(angle) * height * 0.04,
          height - height * 0.03,
          Math.sin(angle) * height * 0.04,
        ],
      }),
    );
  }
  return mergeParts(parts);
}

/** A market umbrella: metal pole, a coloured canopy cone and a rim. */
export function marketUmbrellaParts({
  height,
  radius,
  canopyTone = "accent",
  rimTone = "linen",
}: {
  height: number;
  radius: number;
  canopyTone?: WorldTone;
  rimTone?: WorldTone;
}): PropPart[] {
  return mergeParts([
    part("metal", new CylinderGeometry(height * 0.018, height * 0.018, height, 6), {
      at: [0, height / 2, 0],
    }),
    part(canopyTone, new ConeGeometry(radius, radius * 0.7, 10, 1, true), {
      at: [0, height + radius * 0.2, 0],
    }),
    part(rimTone, new CylinderGeometry(radius * 0.99, radius * 0.99, radius * 0.06, 10), {
      at: [0, height + radius * 0.05, 0],
    }),
  ]);
}

/** A stack of yellow jerrycans in rows and columns, each with a dark handle. */
export function jerrycanStackParts({
  columns,
  rows,
  layers,
  can = { width: 0.2, height: 0.3, depth: 0.13 },
}: {
  columns: number;
  rows: number;
  layers: number;
  can?: { width: number; height: number; depth: number };
}): PropPart[] {
  const parts: PropPart[] = [];
  for (let layer = 0; layer < layers; layer += 1) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = (column - (columns - 1) / 2) * (can.width + 0.02);
        const z = (row - (rows - 1) / 2) * (can.depth + 0.02);
        const y = layer * can.height + can.height / 2;
        parts.push(
          part("jerrycan", new BoxGeometry(can.width, can.height, can.depth), { at: [x, y, z] }),
        );
        parts.push(
          part("metal", new BoxGeometry(can.width * 0.5, can.height * 0.08, can.depth * 0.3), {
            at: [x, y + can.height / 2 + can.height * 0.04, z],
          }),
        );
      }
    }
  }
  return mergeParts(parts);
}

/** An elevated water tank on a braced steel stand, as seen at filling stations and homes. */
export function waterTankParts({
  height,
  tankRadius,
}: {
  height: number;
  tankRadius: number;
}): PropPart[] {
  const legHeight = height * 0.65;
  const legRadius = tankRadius * 0.08;
  const legOffset = tankRadius * 0.7;
  const parts: PropPart[] = [];
  for (const [x, z] of [
    [legOffset, legOffset],
    [-legOffset, legOffset],
    [legOffset, -legOffset],
    [-legOffset, -legOffset],
  ] as const) {
    parts.push(
      part("metal", new CylinderGeometry(legRadius, legRadius, legHeight, 5), {
        at: [x, legHeight / 2, z],
      }),
    );
  }
  for (const y of [legHeight * 0.35, legHeight * 0.7]) {
    parts.push(
      part("metal", new BoxGeometry(legOffset * 2, legRadius * 1.5, legRadius * 1.5), {
        at: [0, y, legOffset],
      }),
    );
    parts.push(
      part("metal", new BoxGeometry(legRadius * 1.5, legRadius * 1.5, legOffset * 2), {
        at: [legOffset, y, 0],
      }),
    );
  }
  parts.push(
    part("slate", new CylinderGeometry(tankRadius, tankRadius, height - legHeight, 12), {
      at: [0, legHeight + (height - legHeight) / 2, 0],
    }),
  );
  parts.push(
    part("slate", new SphereGeometry(tankRadius, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), {
      at: [0, height, 0],
      scale: [1, 0.25, 1],
    }),
  );
  return mergeParts(parts);
}

/** An open dye vat (adire): a concrete ring with a dark indigo liquid surface. */
export function dyeVatParts({ radius, height }: { radius: number; height: number }): PropPart[] {
  return mergeParts([
    part("concrete", new CylinderGeometry(radius, radius * 0.92, height, 12, 1, true), {
      at: [0, height / 2, 0],
    }),
    part("concrete", new CylinderGeometry(radius * 1.04, radius * 1.04, height * 0.08, 12), {
      at: [0, height, 0],
    }),
    part("indigo", new CylinderGeometry(radius * 0.9, radius * 0.9, height * 0.04, 12), {
      at: [0, height * 0.82, 0],
    }),
  ]);
}

/**
 * A glass-and-concrete office tower: a glazed core between concrete corner piers,
 * with a slab band at each floor, a parapet and a plant box on the roof. Metres, base at y = 0.
 */
export function bankTowerParts({
  width,
  depth,
  height,
  floorHeight = 2,
}: {
  width: number;
  depth: number;
  height: number;
  floorHeight?: number;
}): PropPart[] {
  const floors = Math.max(1, Math.round(height / floorHeight));
  const pier = Math.min(width, depth) * 0.12;
  const parts: PropPart[] = [
    part("glass", new BoxGeometry(width - pier, height, depth - pier), { at: [0, height / 2, 0] }),
  ];
  for (let floor = 1; floor < floors; floor++) {
    parts.push(
      part("concrete", new BoxGeometry(width + 0.3, 0.3, depth + 0.3), {
        at: [0, (floor * height) / floors, 0],
      }),
    );
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(
        part("concrete", new BoxGeometry(pier, height, pier), {
          at: [(sx * (width - pier)) / 2, height / 2, (sz * (depth - pier)) / 2],
        }),
      );
    }
  }
  parts.push(
    part("concrete", new BoxGeometry(width + 0.3, 0.8, depth + 0.3), { at: [0, height + 0.4, 0] }),
    part("metal", new BoxGeometry(width * 0.4, 1.1, depth * 0.35), {
      at: [0, height + 1.35, -depth * 0.15],
    }),
  );
  return mergeParts(parts);
}

/**
 * A Nigerian compound: a concrete boundary wall with a gate gap, a house with a veranda,
 * a pitched roof of rusted corrugated sheet, and a water drum. Metres, base at y = 0,
 * centred on x and z.
 */
export function compoundParts({ width, depth }: { width: number; depth: number }): PropPart[] {
  const wallT = 0.2;
  const wallH = 1.8;
  const gate = Math.min(1.2, width * 0.35);
  const side = (width - gate) / 2;
  const houseW = width * 0.72;
  const houseD = depth * 0.5;
  const houseH = 2.6;
  const houseZ = -depth / 2 + wallT + houseD / 2 + 0.05;
  const run = houseD / 2 + 0.08;
  const rise = 0.6;
  const slope = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const parts: PropPart[] = [
    // Boundary walls: north, east, west, and the south wall split around the gate.
    part("wall", new BoxGeometry(width, wallH, wallT), {
      at: [0, wallH / 2, -depth / 2 + wallT / 2],
    }),
    part("wall", new BoxGeometry(wallT, wallH, depth), {
      at: [-width / 2 + wallT / 2, wallH / 2, 0],
    }),
    part("wall", new BoxGeometry(wallT, wallH, depth), {
      at: [width / 2 - wallT / 2, wallH / 2, 0],
    }),
    part("wall", new BoxGeometry(side, wallH, wallT), {
      at: [-(width + gate) / 4, wallH / 2, depth / 2 - wallT / 2],
    }),
    part("wall", new BoxGeometry(side, wallH, wallT), {
      at: [(width + gate) / 4, wallH / 2, depth / 2 - wallT / 2],
    }),
    // Gate posts stand taller than the wall.
    part("concrete", new BoxGeometry(wallT, 2.1, wallT), {
      at: [-gate / 2, 1.05, depth / 2 - wallT / 2],
    }),
    part("concrete", new BoxGeometry(wallT, 2.1, wallT), {
      at: [gate / 2, 1.05, depth / 2 - wallT / 2],
    }),
    // House block, veranda slab and two timber posts.
    part("wall", new BoxGeometry(houseW, houseH, houseD), { at: [0, houseH / 2, houseZ] }),
    part("concrete", new BoxGeometry(houseW + 0.3, 0.1, 0.5), {
      at: [0, 0.05, houseZ + houseD / 2 + 0.25],
    }),
    part("door", new BoxGeometry(0.55, 1.6, 0.05), { at: [0, 0.8, houseZ + houseD / 2 + 0.01] }),
    part("timber", new BoxGeometry(0.08, 2.3, 0.08), {
      at: [-houseW / 2 - 0.1, 1.15, houseZ + houseD / 2 + 0.45],
    }),
    part("timber", new BoxGeometry(0.08, 2.3, 0.08), {
      at: [houseW / 2 + 0.1, 1.15, houseZ + houseD / 2 + 0.45],
    }),
    // Pitched roof of rusted sheet: two slopes meeting at a ridge.
    part("rust", new BoxGeometry(houseW + 0.3, 0.06, slope), {
      at: [0, houseH + rise / 2, houseZ + run / 2],
      rotation: [angle, 0, 0],
    }),
    part("rust", new BoxGeometry(houseW + 0.3, 0.06, slope), {
      at: [0, houseH + rise / 2, houseZ - run / 2],
      rotation: [-angle, 0, 0],
    }),
    // Water drum beside the wall.
    part("metal", new CylinderGeometry(0.25, 0.25, 0.8, 10), {
      at: [width * 0.36, 0.4, -depth / 2 + wallT + 0.3],
    }),
  ];
  return mergeParts(parts);
}

/**
 * A city bus in yellow with a glazed window band, a linen roof and four wheels.
 * Metres, length along x, base at y = 0, centred on x and z.
 */
export function busParts({
  length,
  width,
  height,
}: {
  length: number;
  width: number;
  height: number;
}): PropPart[] {
  const wheelR = 0.45;
  const clear = wheelR * 0.6;
  const bodyH = height * 0.75;
  const wheels: PropPart[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      wheels.push(
        part("roof", new CylinderGeometry(wheelR, wheelR, 0.3, 12), {
          at: [(sx * length) / 3, wheelR, (sz * width) / 2],
          rotation: [0, 0, Math.PI / 2],
        }),
      );
    }
  }
  return mergeParts([
    part("jerrycan", new BoxGeometry(length, bodyH, width), { at: [0, clear + bodyH / 2, 0] }),
    part("linen", new BoxGeometry(length * 0.98, height * 0.06, width * 0.98), {
      at: [0, clear + bodyH + height * 0.03, 0],
    }),
    ...[-1, 1].map((side) =>
      part("glass", new BoxGeometry(length * 0.86, bodyH * 0.35, 0.03), {
        at: [0, clear + bodyH * 0.6, (side * width) / 2 + 0.01],
      }),
    ),
    part("glass", new BoxGeometry(0.03, bodyH * 0.5, width * 0.86), {
      at: [length / 2 + 0.01, clear + bodyH * 0.6, 0],
    }),
    part("metal", new BoxGeometry(0.08, 0.25, width * 0.9), { at: [length / 2 - 0.04, clear, 0] }),
    ...wheels,
  ]);
}

/**
 * A three-wheeled tuk-tuk: a green-yellow cab over the rear axle, a small nose at the front,
 * a metal canopy, and two rear wheels with one at the front. Metres, length along x.
 */
export function tukTukParts({ length, width }: { length: number; width: number }): PropPart[] {
  const wheelR = 0.3;
  const base = wheelR * 1.2;
  const cabL = length * 0.55;
  return mergeParts([
    part("accent", new BoxGeometry(cabL, 0.9, width * 0.95), {
      at: [-length * 0.2, base + 0.45, 0],
    }),
    part("accent", new BoxGeometry(length * 0.3, 0.5, width * 0.5), {
      at: [length * 0.35, base + 0.25, 0],
    }),
    part("metal", new BoxGeometry(cabL, 0.07, width), { at: [-length * 0.2, base + 0.94, 0] }),
    part("glass", new BoxGeometry(cabL * 0.9, 0.5, width * 0.9), {
      at: [-length * 0.2, base + 1.2, 0],
    }),
    part("metal", new BoxGeometry(0.05, 0.6, 0.05), { at: [length * 0.42, base + 0.7, 0] }),
    ...[-1, 1].map((side) =>
      part("roof", new CylinderGeometry(wheelR, wheelR, 0.18, 10), {
        at: [-length * 0.3, wheelR, side * width * 0.4],
        rotation: [0, 0, Math.PI / 2],
      }),
    ),
    part("roof", new CylinderGeometry(wheelR, wheelR, 0.18, 10), {
      at: [length * 0.4, wheelR, 0],
      rotation: [0, 0, Math.PI / 2],
    }),
  ]);
}
