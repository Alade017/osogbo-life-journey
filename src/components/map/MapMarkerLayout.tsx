import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { visibleMapMarkers } from "./map-marker-layout";

import {
  MapMarkerLayoutContext,
  type MapMarkerEntry,
  type MapMarkerRegistry,
} from "./map-marker-registry";

export function MapMarkerLayout({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, MapMarkerEntry>());
  const point = useRef(new Vector3());
  const { invalidate } = useThree();
  const registry = useMemo<MapMarkerRegistry>(
    () => ({
      register(id, entry) {
        entries.current.set(id, entry);
        invalidate();
        return () => {
          entries.current.delete(id);
        };
      },
    }),
    [invalidate],
  );
  useFrame(({ camera, size }) => {
    const projected: { id: string; x: number; y: number; selected: boolean }[] = [];
    entries.current.forEach((entry, id) => {
      if (!entry.group.current || !entry.button.current) return;
      entry.group.current.updateWorldMatrix(true, false);
      entry.group.current.getWorldPosition(point.current);
      point.current.project(camera);
      if (point.current.z < -1 || point.current.z > 1) return;
      projected.push({
        id,
        x: ((point.current.x + 1) * size.width) / 2,
        y: ((1 - point.current.y) * size.height) / 2,
        selected: entry.selected,
      });
    });
    const visible = visibleMapMarkers(projected, size.width, size.height);
    entries.current.forEach((entry, id) => {
      const button = entry.button.current;
      if (button && button.hidden === visible.has(id)) button.hidden = !visible.has(id);
    });
  });
  return (
    <MapMarkerLayoutContext.Provider value={registry}>{children}</MapMarkerLayoutContext.Provider>
  );
}
