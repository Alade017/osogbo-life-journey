import { useCallback, useState } from "react";

type AssetStatus = "ready" | "failed" | "loading";
export function useProductInspection() {
  const [assets, setAssets] = useState<Record<string, AssetStatus>>({});
  const [station, setStation] = useState<number | null>(null);
  const [inspection, setInspection] = useState(false);
  const assetReady = useCallback((id: string) => setAssets(old => old[id] === "ready" ? old : { ...old, [id]: "ready" }), []);
  const assetError = useCallback((id: string) => setAssets(old => old[id] === "failed" ? old : { ...old, [id]: "failed" }), []);
  const assetUnmounted = useCallback((id: string) => setAssets(old => old[id] === "ready" ? { ...old, [id]: "loading" } : old), []);
  return { assetUnmounted, assets, station, setStation, inspection, setInspection, assetReady, assetError };
}
