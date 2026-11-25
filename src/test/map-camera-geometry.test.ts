import { describe, expect, it } from "vitest";
import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import {
  MAP_VIEW_ELEVATION,
  mapCameraFrame,
  mapCameraPanLimits,
} from "@/components/map/map-camera-geometry";

describe("map viewport coverage", () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ] as const)
    for (const level of [1, 2, 4]) {
      it(`keeps ground under all viewport corners at ${w}x${h}, zoom ${level}`, () => {
        const frame = mapCameraFrame(115.2, 86.4, w, h);
        const camera = new OrthographicCamera(
          frame.left,
          frame.right,
          frame.top,
          frame.bottom,
          0.1,
          1000,
        );
        camera.zoom = frame.minZoom * level;
        const limits = mapCameraPanLimits(115.2, 86.4, camera);
        for (const x of [-limits.x, limits.x])
          for (const z of [-limits.z, limits.z]) {
            const target = new Vector3(x, 0, z);
            camera.position
              .copy(target)
              .addScaledVector(new Vector3(0, MAP_VIEW_ELEVATION, 1).normalize(), 230.4);
            camera.lookAt(target);
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
            const ground = new Plane(new Vector3(0, 1, 0), 0);
            for (const nx of [-1, 1])
              for (const ny of [-1, 1]) {
                const ray = new Raycaster();
                ray.setFromCamera(new Vector2(nx, ny), camera);
                const point = ray.ray.intersectPlane(ground, new Vector3());
                expect(point).not.toBeNull();
                expect(Math.abs(point!.x)).toBeLessThanOrEqual(57.6 + 0.0001);
                expect(Math.abs(point!.z)).toBeLessThanOrEqual(43.2 + 0.0001);
              }
          }
      });
    }
});
