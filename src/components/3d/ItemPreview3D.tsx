import { useMemo, useRef, type ComponentType } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, ContactShadows } from "@react-three/drei";
import type { Group } from "three";
import { ITEM_MODELS } from "./item-models";

export function hasItemModel(slug: string | null | undefined): boolean {
  return !!slug && !!ITEM_MODELS[slug];
}

function Turntable({ Model }: { Model: ComponentType }) {
  const ref = useRef<Group>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame((_, delta) => {
    if (ref.current && !reduced) ref.current.rotation.y += delta * 0.6;
  });
  return (
    <group ref={ref}>
      <Center>
        <Model />
      </Center>
    </group>
  );
}

/** A small, slowly turning 3D view of one item. Renders nothing for items without a model. */
export function ItemPreview3D({ slug, label }: { slug: string; label: string }) {
  const Model = ITEM_MODELS[slug];
  if (!Model) return null;
  return (
    <div className="item-preview-3d" role="img" aria-label={`${label}, 3D view`}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.4, 3.6], fov: 34 }} gl={{ antialias: true }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} castShadow />
        <Turntable Model={Model} />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.35} blur={2} far={3} />
      </Canvas>
    </div>
  );
}
