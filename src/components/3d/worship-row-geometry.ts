import { useMemo } from "react";
import { BoxGeometry } from "three";
import { useStrictSafeDisposal } from "./strict-safe-disposal";

/**
 * One geometry per mounted worship hall. Row meshes borrow this geometry via
 * their geometry prop; the hall owns its disposal after the rows unmount.
 * Geometry is deliberately not module-global, so separate scenes cannot
 * dispose one another's resources.
 */
export function useWorshipRowGeometry(isMosque: boolean): BoxGeometry {
  const geometry = useMemo(
    () => new BoxGeometry(isMosque ? 1.5 : 3.6, isMosque ? 0.06 : 0.8, isMosque ? 1.0 : 0.7),
    [isMosque],
  );
  useStrictSafeDisposal(geometry);
  return geometry;
}
