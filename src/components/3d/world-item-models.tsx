import type { ComponentType } from "react";
import { WorldMaterial } from "./WorldScene";

type ItemModelProps = { h: number };

/** A worn backpack: body, front pocket, and two shoulder straps. Sits on the character's back. */
export function BackpackModel({ h }: ItemModelProps) {
  return (
    <group>
      <mesh position={[0, h * 0.6, -h * 0.13]} castShadow>
        <boxGeometry args={[h * 0.26, h * 0.3, h * 0.12]} />
        <WorldMaterial color="#5a3b22" />
      </mesh>
      <mesh position={[0, h * 0.5, -h * 0.2]} castShadow>
        <boxGeometry args={[h * 0.22, h * 0.14, h * 0.05]} />
        <WorldMaterial color="#7a5233" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * h * 0.1, h * 0.68, h * 0.075]} castShadow>
          <boxGeometry args={[h * 0.04, h * 0.2, h * 0.03]} />
          <WorldMaterial color="#3d2716" />
        </mesh>
      ))}
    </group>
  );
}

/** Registry of worn items that have real 3D models. Keys are inventory_items.slug values. */
export const WORN_ITEM_MODELS: Partial<Record<string, ComponentType<ItemModelProps>>> = {
  backpack: BackpackModel,
};