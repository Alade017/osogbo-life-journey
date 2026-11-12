import { type BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";

export type GarmentBand = {
  /** Lowest and highest triangle centre, as fractions of body height. */
  readonly min: number;
  readonly max: number;
  /** How far the garment sits off the skin, as a fraction of body height. */
  readonly inflate: number;
  /** Optional limit on how far from the centre line a triangle may sit, to keep arms out of legwear. */
  readonly sideLimit?: number;
};

/** Garments are cut from the body's own surface, so they fit every base body exactly. */
export const GARMENT_BANDS = {
  shirt: { min: 0.5, max: 0.83, inflate: 0.014 },
  trousers: { min: 0.06, max: 0.6, inflate: 0.012, sideLimit: 0.17 },
  shoes: { min: -0.01, max: 0.05, inflate: 0.018 },
  cap: { min: 0.945, max: 1.06, inflate: 0.022 },
} as const satisfies Record<string, GarmentBand>;

export type GarmentName = keyof typeof GARMENT_BANDS;

/**
 * Keeps the triangles of a unit-height body whose centre lies inside the band, and pushes each
 * vertex outward along its normal. The result is a non-indexed garment shell in the same units.
 */
export function garmentShell(source: BufferGeometry, band: GarmentBand): BufferGeometry {
  const position = source.getAttribute("position") as BufferAttribute;
  const normal = source.getAttribute("normal") as BufferAttribute;
  const index = source.getIndex();
  const vertexAt = (corner: number) => (index ? index.getX(corner) : corner);
  const triangles = (index ? index.count : position.count) / 3;
  const positions: number[] = [];
  const normals: number[] = [];
  for (let t = 0; t < triangles; t++) {
    const ids = [vertexAt(t * 3), vertexAt(t * 3 + 1), vertexAt(t * 3 + 2)];
    const centre = (position.getY(ids[0]!) + position.getY(ids[1]!) + position.getY(ids[2]!)) / 3;
    if (centre < band.min || centre > band.max) continue;
    if (band.sideLimit !== undefined) {
      const side =
        (Math.abs(position.getX(ids[0]!)) +
          Math.abs(position.getX(ids[1]!)) +
          Math.abs(position.getX(ids[2]!))) /
        3;
      if (side > band.sideLimit) continue;
    }
    for (const v of ids) {
      const nx = normal.getX(v);
      const ny = normal.getY(v);
      const nz = normal.getZ(v);
      const length = Math.hypot(nx, ny, nz) || 1;
      positions.push(
        position.getX(v) + (nx / length) * band.inflate,
        position.getY(v) + (ny / length) * band.inflate,
        position.getZ(v) + (nz / length) * band.inflate,
      );
      normals.push(nx / length, ny / length, nz / length);
    }
  }
  const shell = new BufferGeometry();
  shell.setAttribute("position", new Float32BufferAttribute(positions, 3));
  shell.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  return shell;
}
