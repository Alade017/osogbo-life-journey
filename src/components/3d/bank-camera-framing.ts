import { Box3, Euler, Matrix4, OrthographicCamera, Quaternion, Vector3 } from "three";
import type { BankWorldLayout } from "@/game/bank-world-layout";

export const BANK_CAMERA_MAX_ZOOM = 28;
export type BankViewInsets = { top: number; bottom: number; left: number; right: number };

/** Conservative bounds include rotated rails, roof, paving and landscape geometry. */
export function bankSceneBounds(layout: BankWorldLayout): Box3 {
  const result = new Box3();
  for (const part of layout.parts) {
    const transform = new Matrix4().compose(
      new Vector3(...part.position),
      new Quaternion().setFromEuler(new Euler(part.pitch ?? 0, part.yaw ?? 0, 0)),
      new Vector3(...part.size),
    );
    result.union(
      new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(transform),
    );
  }
  return result.expandByScalar(0.35);
}

/** Fit the complete geometry into the part of the canvas not covered by the HUD. */
export function fitBankView(
  camera: OrthographicCamera,
  bounds: Box3,
  width: number,
  height: number,
  insets: BankViewInsets,
) {
  const orientation = new OrthographicCamera();
  orientation.position.set(16, 18, 16);
  orientation.lookAt(0, 0, 0);
  const inverse = orientation.quaternion.clone().invert();
  const viewBounds = bounds.clone().applyMatrix4(new Matrix4().makeRotationFromQuaternion(inverse));
  const size = viewBounds.getSize(new Vector3());
  const center = viewBounds.getCenter(new Vector3());
  const availableWidth = Math.max(1, width - insets.left - insets.right);
  const availableHeight = Math.max(1, height - insets.top - insets.bottom);
  const zoom =
    Math.min(
      BANK_CAMERA_MAX_ZOOM,
      ((camera.right - camera.left) * availableWidth) / (Math.max(1, width) * size.x),
      ((camera.top - camera.bottom) * availableHeight) / (Math.max(1, height) * size.y),
    ) * 0.92;
  const screenX = (insets.left + availableWidth / 2) / Math.max(1, width) - 0.5;
  const screenY = 0.5 - (insets.top + availableHeight / 2) / Math.max(1, height);
  center.x -= (screenX * (camera.right - camera.left)) / zoom;
  center.y -= (screenY * (camera.top - camera.bottom)) / zoom;
  // Moving back as well as zooming out prevents the large compound crossing the near plane.
  const distance = size.z / 2 + 10;
  const target = center.clone().applyQuaternion(orientation.quaternion);
  const position = center
    .clone()
    .add(new Vector3(0, 0, distance))
    .applyQuaternion(orientation.quaternion);
  return { zoom, target, position, far: Math.max(100, size.z + 30) };
}
