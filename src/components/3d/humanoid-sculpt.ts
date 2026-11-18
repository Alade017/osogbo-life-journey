/** Rest-space sculpt for the shared biped. All dimensions are fractions of body height. */
type Point = [number, number, number];
export type BodyField = (x: number, y: number, z: number) => number;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function ellipsoid(c: Point, r: Point): BodyField {
  return (x, y, z) => {
    const p = [x - c[0], y - c[1], z - c[2]];
    const k0 = Math.hypot(...p.map((v, i) => v / r[i]!));
    const k1 = Math.hypot(...p.map((v, i) => v / (r[i]! * r[i]!)));
    return (k0 * (k0 - 1)) / Math.max(k1, 0.000001);
  };
}
function taper(a: Point, b: Point, ra: number, rb: number): BodyField {
  const direction = b.map((v, i) => v - a[i]!);
  const length = direction.reduce((sum, v) => sum + v * v, 0);
  return (x, y, z) => {
    const p = [x - a[0], y - a[1], z - a[2]];
    const t = clamp(p.reduce((sum, v, i) => sum + v * direction[i]!, 0) / length);
    return Math.hypot(...p.map((v, i) => v - t * direction[i]!)) - (ra + (rb - ra) * t);
  };
}
/** Adult silhouettes with defined clavicles, tapered wrists, calves, jaw and cheek planes. */
export function sculptHumanoid(
  female: boolean,
  build: number,
  armSpan: number,
  legSpan: number,
): BodyField {
  const width = [0.9, 1, 1.06, 1.12][build] ?? 1;
  const shoulder = (female ? 0.128 : 0.148) * width;
  const hip = (female ? 0.131 : 0.116) * width;
  const fields: BodyField[] = [
    ellipsoid([0, 0.523, -0.006], [hip, 0.078, 0.082]),
    ellipsoid([0, 0.607, -0.004], [(female ? 0.087 : 0.098) * width, 0.103, 0.068]),
    ellipsoid([0, 0.707, -0.008], [shoulder, 0.091, 0.079]),
    // The neck flares into the shoulders rather than sitting on a separate ball.
    taper([0, 0.757, -0.008], [0, 0.851, 0], female ? 0.038 : 0.043, female ? 0.031 : 0.036),
    ellipsoid([0, 0.938, -0.005], [female ? 0.076 : 0.08, 0.064, 0.07]),
    ellipsoid([0, 0.893, 0.006], [female ? 0.055 : 0.061, 0.039, 0.055]),
    ellipsoid([0, 0.879, 0.024], [female ? 0.038 : 0.044, 0.02, 0.037]),
    taper([0, 0.939, 0.059], [0, 0.909, 0.08], 0.008, 0.011),
    ellipsoid([0, 0.903, 0.077], [0.014, 0.009, 0.011]),
  ];
  for (const side of [-1, 1]) {
    const arm = side * 0.205 * armSpan,
      leg = side * 0.09 * legSpan;
    fields.push(
      taper([side * 0.048, 0.769, -0.003], [arm, 0.78, 0], 0.028, 0.035),
      ellipsoid([arm, 0.776, 0], [(female ? 0.042 : 0.049) * width, 0.044, 0.043]),
      taper(
        [arm, 0.774, 0],
        [arm + side * 0.03, 0.61, 0],
        (female ? 0.04 : 0.047) * width,
        0.03 * width,
      ),
      ellipsoid(
        [arm + side * 0.027, 0.663, -0.004],
        [(female ? 0.036 : 0.041) * width, 0.057, 0.035],
      ),
      taper(
        [arm + side * 0.03, 0.61, 0],
        [arm + side * 0.06, 0.46, 0.003],
        0.031 * width,
        0.019 * width,
      ),
      ellipsoid([arm + side * 0.044, 0.557, -0.003], [0.029 * width, 0.047, 0.027]),
      ellipsoid([arm + side * 0.06, 0.43, 0.005], [0.023 * width, 0.037, 0.017]),
      taper([arm + side * 0.044, 0.452, 0.012], [arm + side * 0.033, 0.42, 0.019], 0.01, 0.008),
      taper([leg, 0.486, -0.002], [leg, 0.25, 0], (female ? 0.06 : 0.055) * width, 0.032 * width),
      ellipsoid([leg, 0.402, -0.009], [(female ? 0.06 : 0.055) * width, 0.079, 0.06]),
      ellipsoid([leg, 0.252, 0.008], [0.034 * width, 0.033, 0.032]),
      taper([leg, 0.248, 0], [leg, 0.053, 0], 0.03 * width, 0.02 * width),
      ellipsoid([leg, 0.171, -0.012], [0.034 * width, 0.06, 0.032]),
      ellipsoid([leg, 0.029, 0.038], [0.033 * width, 0.026, 0.068]),
      ellipsoid([side * (female ? 0.074 : 0.078), 0.925, -0.001], [0.011, 0.021, 0.012]),
      ellipsoid([side * 0.043, 0.92, 0.048], [female ? 0.032 : 0.035, 0.026, 0.023]),
    );
    if (female) fields.push(ellipsoid([side * 0.051, 0.704, 0.049], [0.058 * width, 0.043, 0.037]));
  }
  return (x, y, z) =>
    fields.reduce((best, field) => {
      const b = field(x, y, z),
        k = 0.02;
      const h = clamp(0.5 + (0.5 * (b - best)) / k);
      return b + (best - b) * h - k * h * (1 - h);
    }, 1);
}
