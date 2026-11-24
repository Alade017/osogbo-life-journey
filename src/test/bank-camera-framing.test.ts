import { expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { bankSceneBounds, fitBankView } from "@/components/3d/bank-camera-framing";
import { buildBankWorld } from "@/game/bank-world-layout";

for (const branch of ["cedar-bank", "meridian-bank"] as const)
  for (const area of ["grounds", "hall", "upstairs"] as const)
    for (const [width, height, top, bottom] of [
      [320, 568, 260, 220],
      [390, 844, 180, 220],
      [844, 390, 90, 110],
      [1440, 900, 150, 200],
    ] as const)
      it(`fits ${branch} ${area} inside the unobstructed ${width}x${height} viewport`, () => {
        const camera = new OrthographicCamera(
          -width / 2,
          width / 2,
          height / 2,
          -height / 2,
          0.1,
          100,
        );
        const bounds = bankSceneBounds(buildBankWorld(branch, area));
        const insets = { top, bottom, left: 16, right: 16 };
        const fit = fitBankView(camera, bounds, width, height, insets);
        camera.position.copy(fit.position);
        camera.lookAt(fit.target);
        camera.zoom = fit.zoom;
        camera.far = fit.far;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const projected = new Vector3(x, y, z).project(camera);
              const px = ((projected.x + 1) * width) / 2;
              const py = ((1 - projected.y) * height) / 2;
              expect(px).toBeGreaterThanOrEqual(insets.left);
              expect(px).toBeLessThanOrEqual(width - insets.right);
              expect(py).toBeGreaterThanOrEqual(top);
              expect(py).toBeLessThanOrEqual(height - bottom);
              expect(projected.z).toBeGreaterThan(-1);
              expect(projected.z).toBeLessThan(1);
            }
      });
