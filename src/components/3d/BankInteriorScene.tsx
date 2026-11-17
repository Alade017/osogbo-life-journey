import { WorldMaterial } from "./WorldScene";
import { WORLD_PALETTE, type WorldTone } from "./world-theme";
import { BANK_INTERIORS, type BankInteriorVariant } from "@/game/bank-interiors";
import type { VenueFixture } from "@/lib/location-venue-designs";

type Point = [number, number, number];
function Block({ at, size, tone = "wall", color }: { at: Point; size: Point; tone?: WorldTone; color?: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><WorldMaterial tone={tone} color={color} /></mesh>;
}
function Glazing({ at, size }: { at: Point; size: Point }) {
  return <mesh position={at}><boxGeometry args={size} />
    <meshStandardMaterial color={WORLD_PALETTE.glass} transparent opacity={0.28} roughness={0.25} depthWrite={false} />
  </mesh>;
}
function Seat({ lounge = false }: { lounge?: boolean }) {
  return <group>
    <Block at={[0, 0.38, 0]} size={[lounge ? 0.95 : 0.62, 0.24, 0.65]} tone={lounge ? "slate" : "foliage"} />
    <Block at={[0, 0.77, -0.3]} size={[lounge ? 0.95 : 0.62, 0.65, 0.12]} tone={lounge ? "slate" : "foliage"} />
    {[-0.23, 0.23].map(x => <Block key={x} at={[x, 0.15, 0]} size={[0.07, 0.3, 0.5]} tone="metal" />)}
    {lounge && [-0.49, 0.49].map(x => <Block key={x} at={[x, 0.62, 0]} size={[0.12, 0.3, 0.65]} tone="slate" />)}
  </group>;
}
function Terminal({ infoOnly = false }: { infoOnly?: boolean }) {
  return <group>
    <Block at={[0, 0.7, 0]} size={[infoOnly ? 0.12 : 0.65, 1.4, 0.5]} tone="metal" />
    <Block at={[0, 1.55, 0]} size={[infoOnly ? 1.4 : 0.7, 0.9, 0.14]} tone="slate" />
    <Block at={[0, 1.55, 0.08]} size={[infoOnly ? 1.15 : 0.54, 0.65, 0.02]} tone="glass" />
    {!infoOnly && <Block at={[0, 1.05, 0.18]} size={[0.54, 0.08, 0.4]} tone="metal" />}
  </group>;
}

/** Two structural variants, with the existing venue fixtures owning selection and keyboard labels. */
export function BankInteriorScene({ variant, fixtures, selected, onSelect, floorColor, wallColor, accentColor }: {
  variant: BankInteriorVariant; fixtures: readonly VenueFixture[]; selected: string;
  onSelect: (id: string) => void; floorColor: string; wallColor: string; accentColor: string;
}) {
  const layout = BANK_INTERIORS[variant];
  const traditional = variant === "teller-hall";
  return <group name={traditional ? "bank-teller-hall" : "bank-digital-lounge"}>
    <Block at={[0, -0.1, 0]} size={[layout.width, 0.2, layout.depth]} tone="tileLight" color={floorColor} />
    <Block at={[0, 1.6, -layout.depth / 2]} size={[layout.width, 3.2, 0.16]} color={wallColor} />
    <Block at={[-layout.width / 2, 1.6, 0]} size={[0.16, 3.2, layout.depth]} color={wallColor} />
    <Block at={[layout.width / 2, 0.25, 0]} size={[0.16, 0.5, layout.depth]} color={wallColor} />
    {traditional ? <>
      {/* Timber service backdrop and tiled queue aisle. Front walls remain cut away. */}
      {Array.from({ length: 17 }, (_, index) => <Block key={index} at={[-4.8 + index * 0.6, 1.6, -4.38]} size={[0.12, 2.8, 0.07]} tone="timber" />)}
      <Block at={[0, 0.015, 1.4]} size={[2.6, 0.025, 5.6]} tone="linen" />
      {BANK_INTERIORS["teller-hall"].queueRows.flatMap((z, index) => [-1, 1].map(side => <group key={side + ":" + z} position={[side * 1.35, 0, z]}>
        <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.035, 0.06, 1, 8]} /><WorldMaterial tone="metal" /></mesh>
        <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.16, 0.2, 0.08, 12]} /><WorldMaterial tone="metal" /></mesh>
        {index < BANK_INTERIORS["teller-hall"].queueRows.length - 1 && <Block at={[0, 0.9, 0.65]} size={[0.04, 0.04, 1.3]} tone="sign" />}
      </group>))}
    </> : <>
      {/* Broad windows and a screened advisor area make this an open self-service branch. */}
      {[-3.8, -0.5, 2.8].map(x => <group key={x} position={[x, 0, -4.38]}>
        <Block at={[0, 1.9, 0]} size={[2.6, 2.1, 0.07]} tone="glass" />
        <Block at={[0, 1.9, 0.05]} size={[0.06, 2.1, 0.06]} tone="windowFrame" />
      </group>)}
      <Glazing at={[1.2, 1.2, -1.7]} size={[0.08, 2.4, 3.5]} />
      <Block at={[1.14, 1.35, -1.7]} size={[0.04, 0.4, 3.5]} tone="linen" />
      <Block at={[1.2, 2.4, -1.7]} size={[0.12, 0.1, 3.6]} tone="metal" />
      <Block at={[0, 0.015, 1.1]} size={[4, 0.025, 2.8]} tone="tileShade" />
    </>}
    {fixtures.map(fixture => <group key={fixture.id} position={[fixture.position[0], 0, fixture.position[1]]}
      onClick={event => { event.stopPropagation(); if (event.delta <= 5) onSelect(fixture.id); }}>
      {fixture.kind === "counter" ? traditional ? <>
        <Block at={[0, 0.65, 0]} size={[7.6, 1.3, 0.95]} tone="timber" />
        <Block at={[0, 1.35, 0]} size={[7.8, 0.12, 1.15]} tone="linen" />
        {BANK_INTERIORS["teller-hall"].tellerWindows.map(x => <group key={x} position={[x, 0, 0]}>
          <Glazing at={[0, 1.95, -0.1]} size={[2.1, 1.1, 0.05]} />
          <Block at={[1.05, 1.95, -0.1]} size={[0.06, 1.3, 0.07]} tone="metal" />
          <Block at={[0, 1.43, 0.22]} size={[0.55, 0.05, 0.34]} tone="metal" />
        </group>)}
      </> : <>
        <Block at={[0, 0.82, 0]} size={[2.5, 0.15, 1.3]} tone="linen" />
        <Block at={[0, 0.38, 0]} size={[1.5, 0.76, 0.7]} tone="slate" />
        <Block at={[0.55, 1.17, -0.25]} size={[0.65, 0.52, 0.08]} tone="slate" />
        <group position={[0, 0, 1.15]}><Seat lounge /></group>
      </> : fixture.kind === "screen" ? traditional ? <Terminal infoOnly /> :
        <>{BANK_INTERIORS["digital-lounge"].kioskOffsets.map(x => <group key={x} position={[x, 0, 0]}><Terminal /></group>)}</> :
      traditional ? <>{[-0.7, 0, 0.7].map(x => <group key={x} position={[x, 0, 0]}><Seat /></group>)}</> :
        <>{BANK_INTERIORS["digital-lounge"].loungeAngles.map((angle, index) => <group key={angle} position={[(index ? 1 : -1) * 1.1, 0, 0]} rotation={[0, angle, 0]}><Seat lounge /></group>)}
          <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.45, 0.45, 0.15, 16]} /><WorldMaterial tone="timber" /></mesh></>}
      {selected === fixture.id && <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[traditional && fixture.kind === "counter" ? 1.15 : 0.9, traditional && fixture.kind === "counter" ? 1.22 : 0.97, 32]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>}
    </group>)}
  </group>;
}
