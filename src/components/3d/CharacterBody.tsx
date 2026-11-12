import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Mesh, type MeshStandardMaterial } from "three";
import { buildBodyGeometry } from "./character-body-geometry";

/** The character bodies shipped in public/models/characters. */
export type BodyVariant = "female" | "male" | "courier";

export const BODY_FILES: Record<BodyVariant, string> = {
  female: "/models/characters/female-base.glb",
  male: "/models/characters/male-base.glb",
  courier: "/models/characters/delivery-courier.glb",
};

/** The body that best matches a saved gender. Non-binary characters use the female base. */
export function bodyVariantFor(gender: string): BodyVariant {
  return gender === "male" ? "male" : "female";
}

/**
 * One unit-tall body standing on the origin, scaled to `height`. The skin tone recolours the
 * body's single material; the courier keeps its own clothed grey.
 */
export function CharacterBody({
  variant,
  height,
  skin,
}: {
  variant: BodyVariant;
  height: number;
  skin?: string | undefined;
}) {
  const gltf = useGLTF(BODY_FILES[variant]);
  const geometry = useMemo(() => {
    const mesh = gltf.scene.getObjectByProperty("type", "Mesh") as Mesh | undefined;
    if (!mesh) throw new Error(`Character body ${variant} has no mesh`);
    return buildBodyGeometry(mesh.geometry);
  }, [gltf, variant]);
  const material = useMemo(() => {
    const mesh = gltf.scene.getObjectByProperty("type", "Mesh") as Mesh | undefined;
    const base = mesh?.material as MeshStandardMaterial;
    const copy = base.clone();
    if (skin) copy.color.set(skin);
    return copy;
  }, [gltf, skin]);
  return <mesh geometry={geometry} material={material} scale={height} castShadow receiveShadow />;
}
