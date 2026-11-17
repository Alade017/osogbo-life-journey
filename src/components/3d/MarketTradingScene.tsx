import { WORLD_PALETTE } from "./world-theme";
import { WorldMaterial } from "./WorldScene";
import type { VenueFixture } from "@/lib/location-venue-designs";

/** Open-front market stall; geometry stays inside its existing collision footprint. */
export function MarketStall({
  width = 2.6,
  depth = 1.8,
  variant = 0,
}: {
  width?: number;
  depth?: number;
  variant?: number;
}) {
  const colors = [WORLD_PALETTE.clay, WORLD_PALETTE.foliage, WORLD_PALETTE.sign];
  const style = ((variant % colors.length) + colors.length) % colors.length;
  const accent = colors[style];
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.84, depth * 0.6]} />
        <WorldMaterial tone="timber" />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[width + 0.08, 0.12, depth * 0.72]} />
        <WorldMaterial tone="timber" color={WORLD_PALETTE.timber} />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}:${z}`} position={[x * width * 0.45, 1.3, z * depth * 0.42]} castShadow>
            <boxGeometry args={[0.08, 2.6, 0.08]} />
            <WorldMaterial tone="timber" />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.5, 0]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[width + 0.25, 0.12, depth + 0.25]} />
        <WorldMaterial tone="linen" color={accent} />
      </mesh>
      <mesh position={[0, 2.3, depth * 0.52]} castShadow>
        <boxGeometry args={[width + 0.25, 0.3, 0.06]} />
        <WorldMaterial tone="linen" color={accent} />
      </mesh>
      {[0, 1, 2].map((row) => (
        <group key={row} position={[(row - 1) * width * 0.27, 1.02, 0]}>
          <mesh>
            <boxGeometry args={[width * 0.23, 0.2, depth * 0.48]} />
            <WorldMaterial tone="timber" color={WORLD_PALETTE.door} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * width * 0.055, 0.16, 0]} castShadow>
              {style === 1 ? (
                <cylinderGeometry args={[0.09, 0.12, 0.27, 6]} />
              ) : style === 2 ? (
                <boxGeometry args={[0.16, 0.25, 0.14]} />
              ) : (
                <sphereGeometry args={[0.12, 8, 6]} />
              )}
              <WorldMaterial
                tone="foliage"
                color={style === 0 ? WORLD_PALETTE.rust : style === 1 ? WORLD_PALETTE.sign : WORLD_PALETTE.foliage}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Cutaway trading hall: fixtures retain the venue controller's stable IDs and actions. */
export function MarketTradingHall({
  fixtures,
  selected,
  onSelect,
}: {
  fixtures: readonly VenueFixture[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <group name="market-trading-hall">
      <group position={[0, 0, 3.5]}><MarketEntrance width={6} /></group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[11, 0.2, 8]} />
        <WorldMaterial tone="tileLight" color={WORLD_PALETTE.tileLight} />
      </mesh>
      <mesh position={[0, 1.4, -3.9]} receiveShadow>
        <boxGeometry args={[11, 2.8, 0.16]} />
        <WorldMaterial tone="wall" color={WORLD_PALETTE.wall} />
      </mesh>
      {[-4.7, 4.7].map((x) => (
        <mesh key={x} position={[x, 1.6, -2.4]} castShadow>
          <boxGeometry args={[0.18, 3.2, 0.18]} />
          <WorldMaterial tone="timber" />
        </mesh>
      ))}
      <mesh position={[0, 3.2, -2.4]} castShadow>
        <boxGeometry args={[10, 0.2, 0.25]} />
        <WorldMaterial tone="timber" />
      </mesh>
      {fixtures.map((fixture, index) => (
        <group
          key={fixture.id}
          position={[fixture.position[0], 0, fixture.position[1]]}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= 5) onSelect(fixture.id);
          }}
        >
          {fixture.kind === "seat" ? (
            <>
              <mesh position={[0, 0.45, 0]} castShadow>
                <boxGeometry args={[1.6, 0.16, 0.5]} />
                <WorldMaterial tone="timber" />
              </mesh>
              {[-0.6, 0.6].map((x) => (
                <mesh key={x} position={[x, 0.2, 0]}>
                  <boxGeometry args={[0.12, 0.4, 0.4]} />
                  <WorldMaterial tone="timber" />
                </mesh>
              ))}
            </>
          ) : (
            <MarketStall variant={index} width={2.3} depth={1.5} />
          )}
          {selected === fixture.id && (
            <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.35, 1.43, 32]} />
              <meshBasicMaterial color={WORLD_PALETTE.sign} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function MarketEntrance({ width }: { width: number }) {
  return (
    <group name="market-entrance">
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2, 1.55, 0]} castShadow>
          <boxGeometry args={[0.225, 3.1, 0.225]} />
          <WorldMaterial tone="timber" />
        </mesh>
      ))}
      <mesh position={[0, 3.1, 0]} castShadow>
        <boxGeometry args={[width + 0.3, 0.38, 0.8]} />
        <WorldMaterial tone="linen" color={WORLD_PALETTE.timber} />
      </mesh>
    </group>
  );
}
