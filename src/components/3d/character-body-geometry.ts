import { Box3, type BufferAttribute, type BufferGeometry } from "three";

/**
 * Layout of the supplied character GLBs, as fractions of each model's own height. The three
 * bodies were measured from their vertex distribution: the torso is about 0.12 of height to
 * either side of the centre line, and the arms leave the torso near 0.8 of height.
 */
export const BODY_LAYOUT = {
  /** Half-width of the torso, which is where the arms begin. */
  torso: 0.118,
  /** Height of the shoulder pivot. */
  shoulder: 0.8,
  /** Vertices below this height never belong to an arm. */
  armFloor: 0.3,
  /** Vertices above this height are shoulders or head, and stay put. */
  armCeiling: 0.9,
  /** Half-thickness of an arm, measured from its axis. */
  armThickness: 0.1,
  /** Resting arm angle in the x/y plane, measured from the +x axis: straight down, eased out. */
  restAngle: (-80 * Math.PI) / 180,
} as const;

/**
 * Returns a copy of a supplied character mesh standing on the origin: feet at y=0, centred on x
 * and z, forward on +z, and exactly one unit tall. The T-pose arms are rotated down to the sides
 * because the bodies are single meshes and cannot be animated per limb.
 */
export function buildBodyGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new Box3();
  const height = box.max.y - box.min.y;
  if (!(height > 0)) return geometry;
  const minY = box.min.y;
  const torso = BODY_LAYOUT.torso * height;
  const pivotY = minY + BODY_LAYOUT.shoulder * height;
  const floor = minY + BODY_LAYOUT.armFloor * height;
  const ceiling = minY + BODY_LAYOUT.armCeiling * height;
  const position = geometry.getAttribute("position") as BufferAttribute;

  // The arm tip is the most lateral vertex in the arm band, measured on the +x side.
  let tipX = torso;
  let tipY = pivotY;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    if (x > torso && y > floor && y < ceiling && x > tipX) {
      tipX = x;
      tipY = y;
    }
  }
  // Only vertices close to the shoulder-to-hand axis belong to the arm, so hips and thighs stay put.
  const axisX = tipX - torso;
  const axisY = tipY - pivotY;
  const axisLength = Math.hypot(axisX, axisY);
  const ux = axisX / axisLength;
  const uy = axisY / axisLength;
  const reach = axisLength * 1.15;
  const thickness = BODY_LAYOUT.armThickness * height;
  const delta = BODY_LAYOUT.restAngle - Math.atan2(axisY, axisX);
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const outward = Math.abs(x);
    if (outward <= torso * 0.9 || y <= floor || y >= ceiling) continue;
    const rx = outward - torso;
    const ry = y - pivotY;
    const along = rx * ux + ry * uy;
    const across = Math.abs(rx * uy - ry * ux);
    if (along < -thickness || along > reach || across > thickness) continue;
    // Rotate about the shoulder pivot, working on |x| so both arms share one calculation.
    const side = x < 0 ? -1 : 1;
    position.setXY(i, side * (torso + rx * cos - ry * sin), pivotY + rx * sin + ry * cos);
  }
  position.needsUpdate = true;

  // Centre on the origin and scale so the body is exactly one unit tall.
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox ?? new Box3();
  const centreX = (bounds.max.x + bounds.min.x) / 2;
  const centreZ = (bounds.max.z + bounds.min.z) / 2;
  const scale = 1 / height;
  geometry.translate(-centreX, -bounds.min.y, -centreZ);
  geometry.scale(scale, scale, scale);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
