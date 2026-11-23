import { useEffect, useMemo } from "react";
import { BoxGeometry } from "three";

/**
 * One geometry per mounted worship hall. Row meshes borrow this geometry via
 * their geometry prop; the hall owns its disposal after the rows unmount.
 * Geometry is deliberately not module-global, so separate scenes cannot
 * dispose one another's resources.
 */
export function useWorshipRowGeometry(isMosque: boolean): BoxGeometry {
  const geometry = useMemo(
    () => new BoxGeometry(...(isMosque ? [1.5, 0.06, 1.0] : [3.6, 0.8, 0.7])),
    [isMosque],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
