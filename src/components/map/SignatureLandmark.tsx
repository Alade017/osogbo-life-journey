import { WorldInstances, type WorldInstance } from "../3d/WorldScene";

import { atlasMarkets } from "./atlas-parcels";
const box = (x: number, y: number, z: number, w: number, h: number, d: number): WorldInstance => ({
  position: [x, y, z],
  scale: [w, h, d],
});
const bays = Array.from(
  { length: 9 },
  (_, i) => [((i % 3) - 1) * 0.52, (Math.floor(i / 3) - 1) * 0.43] as const,
);
function SportsGround() {
  return (
    <>
      <mesh scale={[1.5, 1, 0.95]} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[1.1, 1.18, 0.24, 40]} />
        <meshStandardMaterial color="#bc7960" />
      </mesh>
      <mesh scale={[1.45, 1, 0.85]} position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.04, 40]} />
        <meshStandardMaterial color="#466f40" />
      </mesh>
      <WorldInstances items={[box(0, 0.28, 0, 1.9, 0.02, 0.98)]} tone="cityLawn" color="#69a65b" />
      <WorldInstances
        items={[
          box(0, 0.3, 0, 0.025, 0.01, 0.98),
          box(0, 0.32, -0.5, 2, 0.05, 0.04),
          box(0, 0.32, 0.5, 2, 0.05, 0.04),
        ]}
        tone="linen"
      />
    </>
  );
}
export function SignatureLandmark({
  id,
  position,
  cell,
}: {
  id: string;
  position: [number, number, number];
  cell: number;
}) {
  return (
    <group name={id} position={position} scale={cell}>
      {id === "osogbo-township-stadium" ? (
        <SportsGround />
      ) : id === "osun-mall" ? (
        <>
          <WorldInstances
            items={[
              box(0, 0.35, 0, 1.85, 0.7, 1.22),
              box(-0.72, 0.22, 0.69, 0.46, 0.44, 0.4),
              box(0.72, 0.22, 0.69, 0.46, 0.44, 0.4),
            ]}
            tone="linen"
          />
          <WorldInstances items={[box(0, 0.73, 0, 1.9, 0.08, 1.28)]} tone="roofLight" />
          <WorldInstances
            items={[box(0, 0.81, 0, 1.15, 0.13, 0.56), box(0, 0.37, 0.62, 1.6, 0.38, 0.04)]}
            tone="glass"
          />
        </>
      ) : atlasMarkets.has(id) ? (
        <>
          <WorldInstances items={[box(0, 0.035, 0, 1.78, 0.07, 1.54)]} tone="clay" />
          <WorldInstances
            items={bays.map(([x, z]) => box(x, 0.16, z, 0.35, 0.28, 0.24))}
            tone="timber"
          />
          {["#b55d41", "#dfae58", "#407c70"].map((color, row) => (
            <WorldInstances
              key={color}
              items={bays
                .slice(row * 3, row * 3 + 3)
                .map(([x, z]) => box(x, 0.37, z, 0.47, 0.12, 0.33))}
              tone="rust"
              color={color}
            />
          ))}
        </>
      ) : (
        <>
          <WorldInstances items={[box(0, 0.04, 0, 1.75, 0.08, 1.35)]} tone="concrete" />
          <WorldInstances
            items={[
              box(0, 0.4, -0.45, 1.72, 0.12, 0.35),
              box(-0.7, 0.22, -0.45, 0.09, 0.36, 0.09),
              box(0.7, 0.22, -0.45, 0.09, 0.36, 0.09),
            ]}
            tone="indigo"
          />
          <WorldInstances
            items={[-0.56, 0, 0.56].map((x) => box(x, 0.18, 0.18, 0.29, 0.26, 0.64))}
            tone="rust"
            color="#e3a735"
          />
          <WorldInstances
            items={[-0.56, 0, 0.56].map((x) => box(x, 0.32, 0.3, 0.24, 0.04, 0.19))}
            tone="glass"
          />
        </>
      )}
    </group>
  );
}
