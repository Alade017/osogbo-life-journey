import { WorldMaterial } from "./WorldScene";
import { WORLD_PALETTE, type WorldTone } from "./world-theme";
import type { VenueFixture } from "@/lib/location-venue-designs";

export type CivicServiceVariant = "police" | "civic";
type Point = [number, number, number];
function Block({
  at,
  size,
  tone = "wall",
  color,
}: {
  at: Point;
  size: Point;
  tone?: WorldTone;
  color?: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <WorldMaterial tone={tone} color={color} />
    </mesh>
  );
}
function Chair() {
  return (
    <group>
      <Block at={[0, 0.48, 0]} size={[0.65, 0.14, 0.65]} tone="slate" />
      <Block at={[0, 0.88, -0.28]} size={[0.65, 0.7, 0.12]} tone="slate" />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Block
            key={x + ":" + z}
            at={[x * 0.24, 0.23, z * 0.24]}
            size={[0.06, 0.46, 0.06]}
            tone="metal"
          />
        )),
      )}
    </group>
  );
}
function Desk({ counter = false, accent }: { counter?: boolean; accent: string }) {
  return (
    <group>
      <Block at={[0, 0.48, 0]} size={[counter ? 3 : 2.2, 0.96, 0.75]} tone="timber" />
      <Block at={[0, 1, 0]} size={[counter ? 3.2 : 2.4, 0.12, 0.95]} tone="concrete" />
      {counter && <Block at={[0, 0.65, 0.39]} size={[2.8, 0.12, 0.04]} color={accent} />}
      <Block at={[0.45, 1.15, -0.1]} size={[0.07, 0.3, 0.07]} tone="metal" />
      <Block at={[0.45, 1.42, -0.1]} size={[0.7, 0.46, 0.08]} tone="slate" />
      <Block at={[0.45, 1.42, -0.05]} size={[0.6, 0.35, 0.02]} tone="glass" />
      <Block at={[-0.65, 1.09, 0.1]} size={[0.45, 0.04, 0.3]} tone="linen" />
      <group position={[0, 0, -1]}>
        <Chair />
      </group>
    </group>
  );
}
function Board({ accent }: { accent: string }) {
  return (
    <group>
      <Block at={[0, 0.85, 0]} size={[0.1, 1.7, 0.1]} tone="metal" />
      <Block at={[0, 1.8, 0]} size={[1.8, 1.3, 0.12]} tone="timber" />
      <Block at={[0, 1.8, 0.08]} size={[1.65, 1.15, 0.04]} color={accent} />
      {[-0.4, 0.4].map((x) => (
        <Block key={x} at={[x, 1.8, 0.12]} size={[0.55, 0.75, 0.02]} tone="linen" />
      ))}
    </group>
  );
}

/** Open-front cutaway. Fixtures own both pointer selection and the HTML keyboard controls. */
export function CivicServiceScene({
  variant,
  fixtures,
  selected,
  onSelect,
  onWalk,
  floorColor,
  wallColor,
  accentColor,
}: {
  variant: CivicServiceVariant;
  fixtures: readonly VenueFixture[];
  selected: string;
  onSelect: (id: string) => void;
  onWalk: (point: [number, number]) => void;
  floorColor: string;
  wallColor: string;
  accentColor: string;
}) {
  const police = variant === "police";
  return (
    <group name={police ? "community-police-interior" : "civic-service-interior"}>
      <mesh
        position={[0, -0.1, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta <= 5) onWalk([event.point.x, event.point.z]);
        }}
      >
        <boxGeometry args={[14, 0.2, 11]} />
        <WorldMaterial tone="tileLight" color={floorColor} />
      </mesh>
      <Block at={[0, 1.6, -5.5]} size={[14, 3.2, 0.16]} color={wallColor} />
      <Block at={[-7, 1.6, 0]} size={[0.16, 3.2, 11]} color={wallColor} />
      <Block at={[7, 0.25, 0]} size={[0.16, 0.5, 11]} color={wallColor} />
      {/* Public entrance stays unobstructed and the front wall is cut away. */}
      <Block at={[0, 0.015, 1.4]} size={[1.8, 0.03, 8]} tone="linen" />
      <Block at={[0.86, 0.04, 1.4]} size={[0.07, 0.02, 8]} color={accentColor} />
      <Block at={[0, 0.05, 5.1]} size={[2.4, 0.1, 0.65]} tone="concrete" />
      <Block at={[-3.3, 1.8, -5.38]} size={[5.5, 0.5, 0.08]} color={accentColor} />
      {/* Staff office behind a solid rear wall and glazed side partition. */}
      <Block at={[3.7, 0.02, -3.8]} size={[5.7, 0.04, 3.2]} tone={police ? "slate" : "timber"} />
      <Block at={[3.7, 0.5, -2.2]} size={[5.7, 1, 0.12]} color={wallColor} />
      <mesh position={[3.7, 1.85, -2.2]}>
        <boxGeometry args={[5.7, 1.7, 0.06]} />
        <meshStandardMaterial
          color={WORLD_PALETTE.glass}
          transparent
          opacity={0.18}
          depthWrite={false}
          roughness={0.3}
        />
      </mesh>
      <Block at={[0.8, 1.6, -4.2]} size={[0.12, 3.2, 2.5]} color={wallColor} />
      <Block at={[0.8, 1.2, -2.8]} size={[0.12, 2.4, 0.2]} tone="door" />
      {[-6.1, 6.1].map((x) => (
        <group key={x} position={[x, 0, 4.4]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.32, 0.23, 0.5, 10]} />
            <WorldMaterial tone="concrete" />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <sphereGeometry args={[0.43, 10, 8]} />
            <WorldMaterial tone="foliage" />
          </mesh>
        </group>
      ))}
      {fixtures.map((fixture) => (
        <group
          key={fixture.id}
          position={[fixture.position[0], 0, fixture.position[1]]}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= 5) onSelect(fixture.id);
          }}
        >
          {fixture.kind === "counter" || fixture.kind === "table" ? (
            <Desk counter={fixture.kind === "counter"} accent={accentColor} />
          ) : fixture.kind === "screen" ? (
            <Board accent={accentColor} />
          ) : fixture.kind === "seat" ? (
            <>
              {[-1, 0, 1].map((x) => (
                <group key={x} position={[x * 0.85, 0, 0]}>
                  <Chair />
                </group>
              ))}
            </>
          ) : (
            <Block at={[0, 0.8, 0]} size={[1.2, 1.6, 0.55]} tone="timber" />
          )}
          {selected === fixture.id && (
            <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.05, 1.13, 32]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
