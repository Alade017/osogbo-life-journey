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
/** A fitted top worn over the torso. Positions are absolute within the character's body group. */
export function ShirtWorn({
  h,
  color = "#f2efe6",
  accent = "#2f6f4e",
}: ItemModelProps & { color?: string; accent?: string }) {
  return (
    <group>
      {/* Main torso and short sleeves retain the established avatar proportions. */}
      <mesh position={[0, h * 0.57, 0]} castShadow>
        <boxGeometry args={[h * 0.3, h * 0.38, h * 0.19]} />
        <WorldMaterial color={color} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * h * 0.19, h * 0.64, 0]}
          rotation={[0, 0, side * -0.16]}
          castShadow
        >
          <boxGeometry args={[h * 0.12, h * 0.2, h * 0.17]} />
          <WorldMaterial color={color} />
        </mesh>
      ))}
      {/* Collar, centre placket and restrained woven accent strip. */}
      <mesh position={[0, h * 0.755, h * 0.1]}>
        <boxGeometry args={[h * 0.14, h * 0.035, h * 0.025]} />
        <WorldMaterial color={accent} />
      </mesh>
      <mesh position={[0, h * 0.57, h * 0.101]}>
        <boxGeometry args={[h * 0.025, h * 0.25, h * 0.012]} />
        <WorldMaterial color={accent} />
      </mesh>
      <mesh position={[0, h * 0.49, h * 0.108]}>
        <boxGeometry args={[h * 0.11, h * 0.08, h * 0.012]} />
        <WorldMaterial color={accent} />
      </mesh>
      {/* Small geometric woven marks suggest locally patterned fabric without a texture. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * h * 0.095, h * 0.59, h * 0.105]}>
          {[-1, 0, 1].map((row) => (
            <mesh key={row} position={[0, row * h * 0.045, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[h * 0.025, h * 0.025, h * 0.012]} />
              <WorldMaterial color={accent} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Worn tops by slug. Keys must match inventory_items.slug. */
export const WORN_CLOTHING: Partial<Record<string, ComponentType<ItemModelProps>>> = {
  basic_outfit: ShirtWorn,
};
/** Trousers worn over the legs. Positions are estimates from the base legs and should be checked in the preview. */
export function TrousersWorn({ h, color = "#3b4a5c" }: ItemModelProps & { color?: string }) {
  return (
    <group>
      <mesh position={[0, h * 0.2, 0]} castShadow>
        <boxGeometry args={[h * 0.3, h * 0.42, h * 0.18]} />
        <WorldMaterial color={color} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * h * 0.075, h * 0.1, 0]} castShadow>
          <boxGeometry args={[h * 0.13, h * 0.22, h * 0.15]} />
          <WorldMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/** Shoes at the base of each leg. */
export function ShoesWorn({ h, color = "#2a2a2a" }: ItemModelProps & { color?: string }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * h * 0.075, h * 0.03, h * 0.03]} castShadow>
          <boxGeometry args={[h * 0.12, h * 0.07, h * 0.2]} />
          <WorldMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

export const WORN_BOTTOMS: Partial<Record<string, ComponentType<ItemModelProps>>> = {
  sokoto: TrousersWorn,
};

export const WORN_SHOES: Partial<Record<string, ComponentType<ItemModelProps>>> = {
  slippers: ShoesWorn,
};
