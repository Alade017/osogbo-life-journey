import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { type BufferGeometry, Mesh, type MeshStandardMaterial } from "three";
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

/** Each body is built once and shared by every character that uses it. */
const bodyGeometries = new Map<BodyVariant, BufferGeometry>();

/** The unit-tall, arm-lowered geometry for a body, shared across characters. */
export function useBodyGeometry(variant: BodyVariant): BufferGeometry {
  const gltf = useGLTF(BODY_FILES[variant]);
  return useMemo(() => {
    const cached = bodyGeometries.get(variant);
    if (cached) return cached;
    const mesh = gltf.scene.getObjectByProperty("type", "Mesh") as Mesh | undefined;
    if (!mesh) throw new Error(`Character body ${variant} has no mesh`);
    const geometry = buildBodyGeometry(mesh.geometry);
    bodyGeometries.set(variant, geometry);
    return geometry;
  }, [gltf, variant]);
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
  const geometry = useBodyGeometry(variant);
  const gltf = useGLTF(BODY_FILES[variant]);
  const material = useMemo(() => {
    const mesh = gltf.scene.getObjectByProperty("type", "Mesh") as Mesh | undefined;
    const copy = (mesh?.material as MeshStandardMaterial).clone();
    if (skin) copy.color.set(skin);
    return copy;
  }, [gltf, skin]);
  return <mesh geometry={geometry} material={material} scale={height} castShadow receiveShadow />;
}
