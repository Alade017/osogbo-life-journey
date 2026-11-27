import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { BoxGeometry, MeshStandardMaterial } from "three";

type Resources = { box: BoxGeometry; materials: Map<string, MeshStandardMaterial> };
const Context = createContext<Resources | null>(null);

/** Resources belong to one overview canvas, never to a global renderer cache. */
export function OverviewModelResources({ children }: { children: ReactNode }) {
  const resources = useMemo<Resources>(() => ({ box: new BoxGeometry(1,1,1), materials: new Map() }), []);
  useEffect(() => () => {
    resources.box.dispose();
    for (const material of resources.materials.values()) material.dispose();
  }, [resources]);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}

type Vec = [number, number, number];
export function OverviewBox({ position, size, color, rotation }: { position: Vec; size: Vec; color: string; rotation?: Vec | undefined }) {
  const resources = useContext(Context);
  if (!resources) return <mesh position={position} rotation={rotation ?? [0,0,0]}><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>;
  let material = resources.materials.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    resources.materials.set(color, material);
  }
  return <mesh position={position} rotation={rotation ?? [0,0,0]} scale={size} geometry={resources.box} material={material} dispose={null}/>;
}
