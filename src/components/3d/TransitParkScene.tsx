import { WORLD_PALETTE } from "./world-theme";
import type { TravelMode } from "@/lib/transport-service";
import { WorldMaterial } from "./WorldScene";
import type { VenueFixture } from "@/lib/location-venue-designs";

function Minibus({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.45, 1.35, 2.8]} />
        <WorldMaterial tone="accent" color={color} />
      </mesh>
      <mesh position={[0, 1.3, 1.41]}>
        <boxGeometry args={[1.2, 0.55, 0.025]} />
        <WorldMaterial tone="glass" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.735, 1.27, -0.1]}>
            <boxGeometry args={[0.025, 0.5, 1.9]} />
            <WorldMaterial tone="glass" />
          </mesh>
          {[-0.9, 0.9].map((z) => (
            <mesh
              key={z}
              position={[side * 0.72, 0.35, z]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.3, 0.3, 0.15, 12]} />
              <WorldMaterial tone="road" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.5, 1.43]}>
        <boxGeometry args={[1.25, 0.1, 0.06]} />
        <WorldMaterial tone="metal" />
      </mesh>
    </group>
  );
}

/** Static boarding bays: decoration never implies a ride has been booked. */
export function TransitParkScene({
  fixtures,
  selected,
  onSelect,
  onSelectMode,
}: {
  onSelectMode?: (mode: TravelMode) => void;
  fixtures?: readonly VenueFixture[];
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <group name="transit-park-concourse">
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[11, 0.2, 8]} />
        <WorldMaterial tone="concrete" />
      </mesh>
      <mesh position={[0, 0.015, -2.2]} receiveShadow>
        <boxGeometry args={[10.5, 0.03, 3.4]} />
        <WorldMaterial tone="road" />
      </mesh>
      {[-4.3, 0, 4.3].map((x) => (
        <mesh key={x} position={[x, 0.04, -2.2]}>
          <boxGeometry args={[0.07, 0.015, 3.1]} />
          <WorldMaterial tone="roadMarking" />
        </mesh>
      ))}
      <group position={[-2.3, 0, -2.1]} onClick={event => { event.stopPropagation(); if (event.delta <= 5) onSelectMode?.("danfo"); }}>
        <Minibus color={WORLD_PALETTE.jerrycan} />
      </group>
      <group position={[2.3, 0, -2.1]} onClick={event => { event.stopPropagation(); if (event.delta <= 5) onSelectMode?.("danfo"); }}>
        <Minibus color={WORLD_PALETTE.linen} />
      </group>
      {[-4.8, 4.8].map((x) => (
        <mesh key={x} position={[x, 1.55, 1.15]} castShadow>
          <boxGeometry args={[0.16, 3.1, 0.16]} />
          <WorldMaterial tone="metal" />
        </mesh>
      ))}
      <mesh position={[0, 3.1, 1.15]} castShadow>
        <boxGeometry args={[10, 0.16, 2.7]} />
        <WorldMaterial tone="roof" />
      </mesh>
      {fixtures?.map((f) => (
        <group
          key={f.id}
          position={[f.position[0], 0, f.position[1]]}
          onClick={(e) => {
            e.stopPropagation();
            if (e.delta <= 5) onSelect?.(f.id);
          }}
        >
          {f.kind === "bench" ? (
            <>
              <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[1.9, 0.15, 0.55]} />
                <WorldMaterial tone="timber" />
              </mesh>
              <mesh position={[0, 0.8, -0.25]}>
                <boxGeometry args={[1.9, 0.65, 0.12]} />
                <WorldMaterial tone="timber" />
              </mesh>
              {[-0.7, 0.7].map((x) => (
                <mesh key={x} position={[x, 0.23, 0]}>
                  <boxGeometry args={[0.12, 0.46, 0.4]} />
                  <WorldMaterial tone="metal" />
                </mesh>
              ))}
            </>
          ) : f.kind === "screen" ? (
            <>
              <mesh position={[0, 1.5, 0]}>
                <boxGeometry args={[1.6, 1, 0.12]} />
                <WorldMaterial tone="slate" />
              </mesh>
              <mesh position={[0, 0.65, 0]}>
                <boxGeometry args={[0.12, 1.3, 0.12]} />
                <WorldMaterial tone="metal" />
              </mesh>
              {[-0.25, 0, 0.25].map((y) => (
                <mesh key={y} position={[0, 1.5 + y, 0.07]}>
                  <boxGeometry args={[1.2, 0.06, 0.02]} />
                  <WorldMaterial tone="sign" />
                </mesh>
              ))}
            </>
          ) : (
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[1.8, 1.2, 0.7]} />
              <WorldMaterial tone="wall" />
            </mesh>
          )}
          {selected === f.id && (
            <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.1, 1.18, 32]} />
              <meshBasicMaterial color={WORLD_PALETTE.sign} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Street-facing shelter fits the existing entrance footprint at human scale. */
export function TransitShelter({ width, depth }: { width: number; depth: number }) {
  return (
    <group name="transit-street-shelter">
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`${x}:${z}`}
            position={[x * (width / 2 - 0.12), 1.55, z * (depth / 2 - 0.12)]}
            castShadow
          >
            <boxGeometry args={[0.16, 3.1, 0.16]} />
            <WorldMaterial tone="metal" />
          </mesh>
        )),
      )}
      <mesh position={[0, 3.1, 0]} castShadow>
        <boxGeometry args={[width, 0.16, depth]} />
        <WorldMaterial tone="roof" />
      </mesh>
      <mesh position={[-width * 0.2, 0.48, 0]} castShadow>
        <boxGeometry args={[width * 0.4, 0.2, 0.5]} />
        <WorldMaterial tone="timber" />
      </mesh>
      <mesh position={[width * 0.27, 1.4, -depth * 0.3]}>
        <boxGeometry args={[width * 0.3, 1.2, 0.12]} />
        <WorldMaterial tone="slate" />
      </mesh>
      <mesh position={[width * 0.27, 0.6, -depth * 0.3]}>
        <boxGeometry args={[0.1, 1.2, 0.1]} />
        <WorldMaterial tone="metal" />
      </mesh>
    </group>
  );
}
