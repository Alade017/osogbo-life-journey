import type { ComponentType } from "react";
import { Vector2 } from "three";

const mat = (color: string, roughness = 0.75) => (
  <meshStandardMaterial color={color} roughness={roughness} />
);

const plate = (radius: number) => (
  <mesh position={[0, 0.02, 0]} receiveShadow>
    <cylinderGeometry args={[radius, radius * 0.8, 0.04, 40]} />
    {mat("#f4f1ea", 0.35)}
  </mesh>
);

/** Reusable unbranded clear food pouch for locally sold dry goods and bakery items. */
function ClearFoodPouch({
  width,
  height,
  depth,
}: {
  width: number;
  height: number;
  depth: number;
}) {
  return (
    <group>
      <mesh position={[0, height * 0.48, 0]} scale={[width, height * 0.48, depth]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial
          color="#e8f2ed"
          transparent
          opacity={0.2}
          roughness={0.12}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, height * 0.94, 0]}>
        <cylinderGeometry args={[width * 0.18, width * 0.24, 0.045, 16]} />
        {mat("#d6d0b8", 0.8)}
      </mesh>
      <mesh position={[0, height * 0.48, depth * 0.96]}>
        <boxGeometry args={[width * 0.9, height * 0.22, 0.012]} />
        {mat("#eee7d4", 0.9)}
      </mesh>
    </group>
  );
}

/** Puff puff: golden balls on a plate. */
function PuffPuff() {
  const balls: [number, number][] = [
    [0, 0],
    [0.22, 0.12],
    [-0.22, 0.1],
    [0.08, -0.22],
    [-0.12, -0.18],
    [0.3, -0.1],
  ];
  return (
    <group>
      {plate(0.85)}
      {balls.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} castShadow>
          <sphereGeometry args={[0.15, 20, 14]} />
          {mat("#d9902a", 0.6)}
        </mesh>
      ))}
    </group>
  );
}

/** Suya: spiced meat cubes on a skewer. */
function Suya() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.6, 8]} />
        {mat("#c9a46b", 0.6)}
      </mesh>
      {[-0.6, -0.35, -0.1, 0.15, 0.4, 0.62].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0]} rotation={[i * 0.5, i * 0.8, 0]} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          {mat(i % 2 ? "#7a3b1a" : "#8f4a22", 0.8)}
        </mesh>
      ))}
    </group>
  );
}

/** Moi moi: a steamed bean cake wrapped in a leaf. */
function MoiMoi() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.45, 24]} />
        {mat("#b5562a", 0.85)}
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 24]} />
        {mat("#6b8f3a", 0.8)}
      </mesh>
    </group>
  );
}

/** Akara: a stack of round bean fritters. */
function Akara() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[(i - 1) * 0.12, 0.08 + i * 0.1, 0.05 * i]}
          rotation={[0, i * 0.3, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.36, 0.36, 0.14, 28]} />
          {mat("#d6a24a", 0.7)}
        </mesh>
      ))}
    </group>
  );
}

/** Meat pie: a golden half-moon pastry. */
function MeatPie() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.2, 28, 1, false, 0, Math.PI]} />
        {mat("#c98a3a", 0.7)}
      </mesh>
    </group>
  );
}

/** Fried plantain: golden slices on a plate. */
function FriedPlantain() {
  const slices: [number, number][] = [
    [-0.25, 0.1],
    [0.05, -0.12],
    [0.3, 0.18],
  ];
  return (
    <group>
      {plate(0.8)}
      {slices.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]} rotation={[0.2, i, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 20]} />
          {mat("#e0b13a", 0.6)}
        </mesh>
      ))}
    </group>
  );
}

/** Bread: a soft loaf. */
function Bread() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} scale={[1.4, 0.7, 0.8]} castShadow>
        <sphereGeometry args={[0.5, 28, 18]} />
        {mat("#c98a4b", 0.9)}
      </mesh>
      <ClearFoodPouch width={0.78} height={0.58} depth={0.48} />
    </group>
  );
}

/** Chin chin: small crunchy cubes in a pile. */
function ChinChin() {
  return (
    <group>
      {Array.from({ length: 18 }, (_, i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 2.1) * 0.35, 0.08 + (i % 3) * 0.06, Math.sin(i * 2.1) * 0.35]}
          rotation={[i, i * 0.7, 0]}
          castShadow
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          {mat("#c98a3a", 0.7)}
        </mesh>
      ))}
      <ClearFoodPouch width={0.58} height={0.58} depth={0.58} />
    </group>
  );
}

const BOWL_PROFILE = [
  [0, 0],
  [0.5, 0],
  [0.62, 0.2],
  [0.66, 0.45],
  [0.6, 0.5],
].map(([x, y]) => new Vector2(x, y));

/** Pepper soup: a bowl of red broth. */
function PepperSoup() {
  return (
    <group>
      <mesh castShadow>
        <latheGeometry args={[BOWL_PROFILE, 32]} />
        {mat("#f4f1ea", 0.3)}
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.02, 32]} />
        {mat("#b8552a", 0.3)}
      </mesh>
    </group>
  );
}

/** A boiled egg, halved in the middle of the plate. */
function BoiledEgg() {
  return (
    <group>
      {plate(0.6)}
      <mesh position={[0, 0.3, 0]} scale={[1, 1.25, 1]} castShadow>
        <sphereGeometry args={[0.25, 24, 18]} />
        {mat("#fbf7ef", 0.4)}
      </mesh>
    </group>
  );
}
/** Insulated flask: a steel body with a dark lid. */
function InsulatedFlask() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.2, 0.9, 32]} />
        {mat("#c9ced4", 0.25)}
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.12, 32]} />
        {mat("#222326", 0.4)}
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 32]} />
        {mat("#222326", 0.5)}
      </mesh>
    </group>
  );
}

/** Food models by slug. Replace these placeholder keys with the real inventory_items slugs. */
export const FOOD_MODELS: Partial<Record<string, ComponentType>> = {
  puff_puff: PuffPuff,
  suya: Suya,
  moi_moi: MoiMoi,
  akara: Akara,
  meat_pie: MeatPie,
  fried_plantain: FriedPlantain,
  bread: Bread,
  chin_chin: ChinChin,
  pepper_soup: PepperSoup,
  boiled_egg: BoiledEgg,
  insulated_flask: InsulatedFlask,
};
