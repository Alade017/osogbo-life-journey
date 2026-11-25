import { useCallback, useState } from "react";

type AssetStatus = "ready" | "failed" | "loading";
export function useProductInspection() {
  const [assets, setAssets] = useState<Record<string, AssetStatus>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [station, setStation] = useState<number | null>(null);
  const [inspection, setInspection] = useState(false);
  const assetReady = useCallback((id: string) => setAssets(old => old[id] === "ready" ? old : { ...old, [id]: "ready" }), []);
  const assetError = useCallback((id: string) => setAssets(old => old[id] === "failed" ? old : { ...old, [id]: "failed" }), []);
  const assetUnmounted = useCallback((id: string) => setAssets(old => old[id] === "ready" ? { ...old, [id]: "loading" } : old), []);
  const retryAsset = useCallback((id: string) => {
    setAssets(old => ({ ...old, [id]: "loading" }));
    setAttempts(old => ({ ...old, [id]: (old[id] ?? 0) + 1 }));
  }, []);
  return { attempts, retryAsset, assetUnmounted, assets, station, setStation, inspection, setInspection, assetReady, assetError };
}
