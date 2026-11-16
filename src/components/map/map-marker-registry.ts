import { createContext, useContext, useLayoutEffect, type RefObject } from "react";
import type { Group } from "three";
export type MapMarkerEntry = {
  group: RefObject<Group | null>;
  button: RefObject<HTMLButtonElement | null>;
  selected: boolean;
};
export type MapMarkerRegistry = { register: (id: string, entry: MapMarkerEntry) => () => void };
export const MapMarkerLayoutContext = createContext<MapMarkerRegistry | null>(null);

export function useMapMarkerLayout(id: string, entry: MapMarkerEntry) {
  const registry = useContext(MapMarkerLayoutContext);
  const { group, button, selected } = entry;
  useLayoutEffect(
    () => registry?.register(id, { group, button, selected }),
    [registry, id, group, button, selected],
  );
}
