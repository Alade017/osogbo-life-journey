import { useEffect } from "react";

/** Scene readiness follows content mounting, not the retained renderer's one-time creation. */
export function WorldSceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}
