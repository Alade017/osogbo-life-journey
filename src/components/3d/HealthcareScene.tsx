import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldMaterial } from "./WorldScene";
import type { VenueFixture } from "@/lib/location-venue-designs";

export function HealthcareFrontage({ width, depth }: { width: number; depth: number }) {
  return (
    <group name="healthcare-frontage">
      <mesh position={[0, 1.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 3.3, depth]} />
        <WorldMaterial tone="wall" color={WORLD_PALETTE.wall} />
      </mesh>
      <mesh position={[0, 3.38, 0]} castShadow>
        <boxGeometry args={[width + 0.1, 0.16, depth + 0.1]} />
        <WorldMaterial tone="roofLight" />
      </mesh>
      <mesh position={[0, 1.05, depth / 2 + 0.01]}>
        <boxGeometry args={[Math.min(1, width * 0.25), 2.1, 0.04]} />
        <WorldMaterial tone="glass" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * width * 0.32, 1.6, depth / 2 + 0.02]}>
          <boxGeometry args={[width * 0.18, 0.8, 0.04]} />
          <WorldMaterial tone="glass" />
        </mesh>
      ))}
      <mesh position={[0, 2.6, depth / 2 + 0.15]} castShadow>
        <boxGeometry args={[width * 0.7, 0.14, 0.5]} />
        <WorldMaterial tone="foliage" color={WORLD_PALETTE.foliage} />
      </mesh>
      <mesh position={[0, 3, depth / 2 + 0.03]}>
        <boxGeometry args={[0.45, 0.1, 0.06]} />
        <WorldMaterial tone="foliage" color={WORLD_PALETTE.foliage} />
      </mesh>
      <mesh position={[0, 3, depth / 2 + 0.04]}>
        <boxGeometry args={[0.1, 0.45, 0.06]} />
        <WorldMaterial tone="foliage" color={WORLD_PALETTE.foliage} />
      </mesh>
    </group>
  );
}

/** Cutaway reception. Selecting furniture never changes health or submits treatment. */
export function HealthcareScene({
  fixtures,
  selected,
  onSelect,
}: {
  fixtures: readonly VenueFixture[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <group name="healthcare-reception">
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[11, 0.2, 8]} />
        <WorldMaterial tone="tileLight" color={WORLD_PALETTE.tileLight} />
      </mesh>
      <mesh position={[0, 1.5, -3.9]} receiveShadow>
        <boxGeometry args={[11, 3, 0.16]} />
        <WorldMaterial tone="wall" color={WORLD_PALETTE.linen} />
      </mesh>
      <mesh position={[-5.4, 1.5, -1]} receiveShadow>
        <boxGeometry args={[0.16, 3, 5.8]} />
        <WorldMaterial tone="wall" color={WORLD_PALETTE.linen} />
      </mesh>
      <mesh position={[0.8, 1.1, -2]}>
        <boxGeometry args={[0.1, 2.2, 2.7]} />
        <WorldMaterial tone="linen" color={WORLD_PALETTE.tileBath} />
      </mesh>
      {fixtures.map((f) => (
        <group
          key={f.id}
          position={[f.position[0], 0, f.position[1]]}
          onClick={(e) => {
            e.stopPropagation();
            if (e.delta <= 5) onSelect(f.id);
          }}
        >
          {f.kind === "counter" ? (
            <>
              <mesh position={[0, 0.57, 0]} castShadow>
                <boxGeometry args={[2.3, 1.14, 0.8]} />
                <WorldMaterial tone="wall" color={WORLD_PALETTE.foliage} />
              </mesh>
              <mesh position={[0, 1.18, 0]}>
                <boxGeometry args={[2.45, 0.12, 0.95]} />
                <WorldMaterial tone="tileLight" />
              </mesh>
              <mesh position={[0.55, 1.45, -0.15]}>
                <boxGeometry args={[0.5, 0.4, 0.08]} />
                <WorldMaterial tone="slate" />
              </mesh>
            </>
          ) : f.kind === "seat" ? (
            <>
              {[-0.85, 0, 0.85].map((x) => (
                <group key={x} position={[x, 0, 0]}>
                  <mesh position={[0, 0.5, 0]} castShadow>
                    <boxGeometry args={[0.65, 0.15, 0.6]} />
                    <WorldMaterial tone="foliage" color={WORLD_PALETTE.foliage} />
                  </mesh>
                  <mesh position={[0, 0.8, -0.3]}>
                    <boxGeometry args={[0.65, 0.65, 0.1]} />
                    <WorldMaterial tone="foliage" color={WORLD_PALETTE.foliage} />
                  </mesh>
                  {[-0.22, 0.22].map((z) => (
                    <mesh key={z} position={[0, 0.22, z]}>
                      <boxGeometry args={[0.5, 0.44, 0.08]} />
                      <WorldMaterial tone="metal" />
                    </mesh>
                  ))}
                </group>
              ))}
            </>
          ) : (
            <>
              <mesh position={[0, 0.75, 0]} castShadow>
                <boxGeometry args={[1.35, 0.25, 2.2]} />
                <WorldMaterial tone="linen" />
              </mesh>
              <mesh position={[0, 0.45, 0]}>
                <boxGeometry args={[1, 0.6, 1.8]} />
                <WorldMaterial tone="metal" />
              </mesh>
              <mesh position={[0, 0.95, -0.65]}>
                <boxGeometry args={[1, 0.18, 0.55]} />
                <WorldMaterial tone="linen" color={WORLD_PALETTE.linen} />
              </mesh>
            </>
          )}
          {selected === f.id && (
            <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.4, 1.48, 32]} />
              <meshBasicMaterial color={WORLD_PALETTE.foliage} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
