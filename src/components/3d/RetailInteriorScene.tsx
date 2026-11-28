import { WorldMaterial } from "./WorldScene";
import { WORLD_PALETTE, type WorldTone } from "./world-theme";
import type { VenueFixture } from "@/lib/location-venue-designs";

type Point = [number, number, number];
function Block({
  at,
  size,
  tone = "wall",
  color,
}: {
  at: Point;
  size: Point;
  tone?: WorldTone | undefined;
  color?: string | undefined;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <WorldMaterial tone={tone} {...(color === undefined ? {} : { color })} />
    </mesh>
  );
}
function Shelf() {
  return (
    <group>
      <Block at={[-1.75, 1, 0]} size={[0.12, 2, 0.85]} tone="metal" />
      <Block at={[1.75, 1, 0]} size={[0.12, 2, 0.85]} tone="metal" />
      {[0.2, 0.8, 1.4].map((y, row) => (
        <group key={y}>
          <Block at={[0, y, 0]} size={[3.6, 0.09, 0.85]} tone="linen" />
          {[-1.2, -0.4, 0.4, 1.2].map((x, column) => (
            <group key={x}>
              <Block
                at={[x, y + 0.22, 0]}
                size={[0.5, 0.35, 0.5]}
                tone={(column + row) % 2 ? "timber" : "foliage"}
              />
              <Block at={[x, y + 0.22, 0.26]} size={[0.27, 0.18, 0.02]} tone="linen" />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
function Checkout({ accent }: { accent: string }) {
  return (
    <group>
      <Block at={[0, 0.5, 0]} size={[3.5, 1, 1.15]} color={accent} />
      <Block at={[0, 1.05, 0]} size={[3.7, 0.1, 1.25]} tone="concrete" />
      <Block at={[-0.6, 1.12, 0]} size={[1.9, 0.04, 0.85]} tone="slate" />
      <Block at={[1.1, 1.24, 0]} size={[0.1, 0.3, 0.1]} tone="metal" />
      <Block at={[1.1, 1.55, 0]} size={[0.7, 0.45, 0.1]} tone="slate" />
      <Block at={[1.1, 1.55, 0.06]} size={[0.56, 0.31, 0.02]} tone="glass" />
    </group>
  );
}

/** Display packs are scenery; catalogue, availability and checkout stay server-authoritative. */
export function RetailInteriorScene({
  fixtures,
  selected,
  onSelect,
  onWalk,
  floorColor,
  wallColor,
  accentColor,
}: {
  fixtures: readonly VenueFixture[];
  selected: string;
  onSelect: (id: string) => void;
  onWalk: (point: [number, number]) => void;
  floorColor: string;
  wallColor: string;
  accentColor: string;
}) {
  return (
    <group name="mall-gallery-and-supermarket">
      <Block at={[0, -0.1, 0]} size={[16, 0.2, 14]} tone="tileLight" color={floorColor} />
      <mesh
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.button === 0 && event.delta <= 5) onWalk([event.point.x, event.point.z]);
        }}
      >
        <planeGeometry args={[15.6, 13.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Block at={[0, 1.8, -7]} size={[16, 3.6, 0.18]} color={wallColor} />
      <Block at={[-8, 1.8, 0]} size={[0.18, 3.6, 14]} color={wallColor} />
      <Block at={[8, 0.25, 0]} size={[0.18, 0.5, 14]} color={wallColor} />
      <Block at={[0, 0.015, 0]} size={[2.2, 0.03, 13]} tone="linen" />
      {[-1, 1].map((side) => (
        <Block key={side} at={[side * 1.1, 0.04, 0]} size={[0.06, 0.02, 13]} color={accentColor} />
      ))}
      <Block at={[0, 0.05, 6.5]} size={[2.7, 0.1, 0.8]} tone="concrete" />
      {/* Gallery shopfronts and high rear shelving leave the camera-facing edge open. */}
      {[-3.2, 2.2].map((z) => (
        <group key={z}>
          <Block at={[-7.85, 1.8, z]} size={[0.12, 2.8, 3.6]} tone="timber" />
          <mesh position={[-7.75, 1.8, z]}>
            <boxGeometry args={[0.06, 2.5, 3.3]} />
            <meshStandardMaterial
              color={WORLD_PALETTE.glass}
              transparent
              opacity={0.22}
              depthWrite={false}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}
      <Block at={[3.8, 2.8, -6.88]} size={[6, 0.5, 0.12]} color={accentColor} />
      {/* Closed stockroom wall and door are scenery, never inventory storage controls. */}
      <Block at={[6.8, 1.3, -6.85]} size={[1.1, 2.6, 0.1]} tone="door" />
      <Block at={[7.15, 1.3, -6.77]} size={[0.08, 0.12, 0.05]} tone="metal" />
      {fixtures.map((fixture) => (
        <group
          key={fixture.id}
          position={[fixture.position[0], 0, fixture.position[1]]}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= 5) onSelect(fixture.id);
          }}
        >
          {fixture.kind === "shelf" ? (
            <Shelf />
          ) : fixture.kind === "counter" ? (
            <Checkout accent={accentColor} />
          ) : fixture.kind === "seat" ? (
            <>
              <Block at={[0, 0.48, 0]} size={[2.3, 0.18, 0.65]} tone="timber" />
              <Block at={[0, 0.85, -0.3]} size={[2.3, 0.7, 0.12]} tone="timber" />
              {[-0.85, 0.85].map((x) => (
                <Block key={x} at={[x, 0.2, 0]} size={[0.12, 0.4, 0.5]} tone="metal" />
              ))}
            </>
          ) : (
            <>
              <Block at={[0, 0.5, 0]} size={[2, 1, 1.6]} tone="concrete" />
              {[-0.5, 0.5].map((x) => (
                <Block key={x} at={[x, 1.25, 0]} size={[0.6, 0.5, 0.7]} color={accentColor} />
              ))}
            </>
          )}
          {selected === fixture.id && (
            <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.25, 1.34, 32]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          )}
        </group>
      ))}
      {/* Two short queue guides leave the centre aisle and front exit clear. */}
      {[2.4, 5.6].map((x) => (
        <group key={x}>
          <Block at={[x, 0.48, 5.5]} size={[0.08, 0.96, 0.08]} tone="metal" />
          <Block at={[x, 0.04, 5.5]} size={[0.35, 0.08, 0.35]} tone="metal" />
        </group>
      ))}
    </group>
  );
}
