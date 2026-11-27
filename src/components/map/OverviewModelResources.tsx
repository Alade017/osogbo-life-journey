import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, MeshStandardMaterial, type BufferGeometry } from "three";

type Shape = "box" | "cylinder6" | "cylinder16" | "cone" | "dome" | "icosahedron";
type Resources = { geometries: Record<Shape, BufferGeometry>; materials: Map<string, MeshStandardMaterial> };
const Context = createContext<Resources | null>(null);

function createResources(): Resources {
  return { geometries: {
    box: new BoxGeometry(1,1,1),
    cylinder6: new CylinderGeometry(1,1,1,6),
    cylinder16: new CylinderGeometry(1,1,1,16),
    cone: new ConeGeometry(1,1,4),
    dome: new SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),
    icosahedron: new IcosahedronGeometry(1,0),
  }, materials: new Map() };
}
/** Shared GPU resources are scoped to this overview canvas. */
export function OverviewModelResources({ children }: { children: ReactNode }) {
  const resources = useMemo(createResources, []);
  useEffect(() => () => {
    for (const geometry of Object.values(resources.geometries)) geometry.dispose();
    for (const material of resources.materials.values()) material.dispose();
  }, [resources]);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}

type Vec = [number, number, number];
type PrimitiveProps = { position: Vec; size: Vec; color: string; rotation?: Vec | undefined };
export function OverviewPrimitive({ shape, position, size, color, rotation }: PrimitiveProps & { shape: Shape }) {
  const resources = useContext(Context);
  if (!resources) return <mesh position={position} rotation={rotation ?? [0,0,0]} scale={size}>
    {shape === "box" ? <boxGeometry args={[1,1,1]}/> :
      shape === "cone" ? <coneGeometry args={[1,1,4]}/> :
      shape === "dome" ? <sphereGeometry args={[1,16,8,0,Math.PI*2,0,Math.PI/2]}/> :
      shape === "icosahedron" ? <icosahedronGeometry args={[1,0]}/> :
      <cylinderGeometry args={[1,1,1,shape === "cylinder6" ? 6 : 16]}/>}
    <meshStandardMaterial color={color}/>
  </mesh>;
  let material = resources.materials.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    resources.materials.set(color, material);
  }
  return <mesh position={position} rotation={rotation ?? [0,0,0]} scale={size} geometry={resources.geometries[shape]} material={material} dispose={null}/>;
}
export function OverviewBox(props: PrimitiveProps) {
  return <OverviewPrimitive shape="box" {...props}/>;
}
