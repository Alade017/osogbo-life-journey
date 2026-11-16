import type { ComponentType } from "react";
import { Vector2 } from "three";
import { BackpackModel, ShoesWorn, TrousersWorn } from "./world-item-models";
import { FOOD_MODELS } from "./food-models";

const pbr = (color: string, roughness = 0.7) => (
  <meshStandardMaterial color={color} roughness={roughness} />
);

/** A plate of jollof rice with chicken and plantain. Units are roughly centimetres. */
function JollofPlate() {
  const grains = Array.from({ length: 26 }, (_, i) => {
    const angle = i * 2.399;
    const radius = 0.12 + (i % 7) * 0.07;
    return {
      key: i,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: 0.42 + (i % 3) * 0.03,
      dark: i % 2 === 0,
    };
  });
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.7, 0.08, 40]} />
        {pbr("#f4f1ea", 0.35)}
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.62, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {pbr("#c8461e", 0.8)}
      </mesh>
      {grains.map((g) => (
        <mesh key={g.key} position={[g.x, g.y, g.z]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          {pbr(g.dark ? "#7a2a10" : "#e8a33a", 0.6)}
        </mesh>
      ))}
      {(
        [
          [-0.3, 0.46, 0.1, 0.4],
          [0.28, 0.44, -0.18, 1.1],
          [0.05, 0.5, 0.3, 2.0],
        ] as [number, number, number, number][]
      ).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.4, r, 0.2]} castShadow>
          <boxGeometry args={[0.22, 0.12, 0.16]} />
          {pbr("#8a4a1c", 0.7)}
        </mesh>
      ))}
      <mesh position={[0.45, 0.2, 0.38]} rotation={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
        {pbr("#d9a53b", 0.6)}
      </mesh>
    </group>
  );
}

/** A glass of zobo: red hibiscus drink in a clear glass. */
function ZoboGlass() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.28, 1, 32, 1, true]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.22} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.33, 0.26, 0.8, 32]} />
        <meshStandardMaterial color="#9b1d2a" roughness={0.15} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.04, 32]} />
        {pbr("#ffffff", 0.3)}
      </mesh>
    </group>
  );
}

const BOTTLE_PROFILE = [
  [0, 0],
  [0.42, 0],
  [0.46, 0.08],
  [0.46, 1.1],
  [0.3, 1.26],
  [0.2, 1.4],
  [0.2, 1.52],
  [0, 1.52],
].map(([x, y]) => new Vector2(x, y));

/** A clear plastic water bottle with a blue cap and label. */
function WaterBottle({ liquid = "#bfe6f7", cap = "#2b6fb3" }: { liquid?: string; cap?: string }) {
  return (
    <group>
      {/* Clear bottle shell and shoulder profile. */}
      <mesh castShadow>
        <latheGeometry args={[BOTTLE_PROFILE, 32]} />
        <meshStandardMaterial color={liquid} transparent opacity={0.55} roughness={0.08} />
      </mesh>
      {/* Unbranded wrap label: visual packaging detail without copying a real product identity. */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.468, 0.468, 0.48, 32, 1, true]} />
        {pbr("#f2f4ef", 0.72)}
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.472, 0.472, 0.11, 32, 1, true]} />
        {pbr("#1e5fa8", 0.52)}
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.469, 0.469, 0.055, 32, 1, true]} />
        {pbr("#d7e7df", 0.8)}
      </mesh>
      {/* Molded grip rings and a tamper-evident cap. */}
      {[
        { y: 0.16, radius: 0.43 },
        { y: 1.02, radius: 0.44 },
        { y: 1.28, radius: 0.28 },
      ].map(({ y, radius }) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.018, 6, 32]} />
          {pbr("#a9d5e8", 0.28)}
        </mesh>
      ))}
      <mesh position={[0, 1.58, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.14, 24]} />
        {pbr(cap, 0.4)}
      </mesh>
      <mesh position={[0, 1.49, 0]}>
        <cylinderGeometry args={[0.205, 0.205, 0.035, 24]} />
        {pbr(cap, 0.55)}
      </mesh>
    </group>
  );
}

/** Folded shirt preview with details shared visually with the worn outfit. */
function Shirt({ color = "#f2efe6", accent = "#2f6f4e" }: { color?: string; accent?: string }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.9, 1, 0.36]} />
        {pbr(color, 0.9)}
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.62, 0.32, 0]} rotation={[0, 0, side * -0.5]}>
          <mesh castShadow>
            <boxGeometry args={[0.36, 0.6, 0.32]} />
            {pbr(color, 0.9)}
          </mesh>
          <mesh position={[0, -0.25, 0.17]}>
            <boxGeometry args={[0.34, 0.055, 0.025]} />
            {pbr(accent, 0.82)}
          </mesh>
        </group>
      ))}
      {/* Folded collar and front placket. */}
      <mesh position={[0, 1.02, 0.19]}>
        <boxGeometry args={[0.36, 0.14, 0.04]} />
        {pbr(accent, 0.8)}
      </mesh>
      <mesh position={[0, 0.54, 0.19]}>
        <boxGeometry args={[0.045, 0.58, 0.025]} />
        {pbr(accent, 0.82)}
      </mesh>
      <mesh position={[0.24, 0.62, 0.19]}>
        <boxGeometry args={[0.22, 0.2, 0.025]} />
        {pbr(accent, 0.82)}
      </mesh>
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.92, 0.04, 0.38]} />
        {pbr(accent, 0.9)}
      </mesh>
    </group>
  );
}

export const ITEM_MODELS: Partial<Record<string, ComponentType>> = {
  ...FOOD_MODELS,
  jollof_rice: JollofPlate,
  zobo: ZoboGlass,
  water_bottle: WaterBottle,
  water_nature: () => <WaterBottle liquid="#d8f0ff" cap="#2e8b57" />,
  backpack: () => <BackpackModel h={1} />,
  basic_outfit: Shirt,
  sokoto: () => <TrousersWorn h={1} />,
  slippers: () => <ShoesWorn h={1} />,
};
