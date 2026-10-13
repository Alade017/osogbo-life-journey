import { useCallback } from "react";
import type { ThreeEvent } from "@react-three/fiber";
export function useCityInteractions(onLocationSelect?: (id: string) => void) {
  return useCallback(
    (id: string, event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onLocationSelect?.(id);
    },
    [onLocationSelect],
  );
}
