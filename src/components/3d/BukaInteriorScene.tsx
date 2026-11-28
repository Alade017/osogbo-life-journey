import { WorldMaterial } from "./WorldScene";
import type { WorldTone } from "./world-theme";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { FOOD_VENUE_LAYOUTS, type FoodVenueVariant } from "@/game/food-venue-layout";
type Point = [number, number, number];
function Block({ at, size, tone = "wall", color }: { at: Point; size: Point; tone?: WorldTone; color?: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><WorldMaterial tone={tone} {...(color === undefined ? {} : { color })} /></mesh>;
}
function CookingPot() {
  return <group>
    <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.4, 0.3, 0.44, 16]} /><WorldMaterial tone="metal" /></mesh>
    <mesh position={[0, 0.46, 0]}><cylinderGeometry args={[0.43, 0.43, 0.07, 16]} /><WorldMaterial tone="concrete" /></mesh>
    <Block at={[0, 0.54, 0]} size={[0.14, 0.1, 0.08]} tone="timber" />
    {[-1, 1].map(side => <Block key={side} at={[side * 0.46, 0.25, 0]} size={[0.18, 0.08, 0.12]} tone="metal" />)}
  </group>;
}
/** Decorative kitchen equipment never claims menu stock, cooking progress or food availability. */
export function BukaInteriorScene({ variant = "buka", fixtures, selected, onSelect, onWalk, floorColor, wallColor, accentColor }: {
  variant?: FoodVenueVariant;
  fixtures: readonly VenueFixture[]; selected: string; onSelect: (id: string) => void;
  floorColor: string; wallColor: string; accentColor: string;
  onWalk: (point: readonly [number, number]) => void;
}) {
  const layout = FOOD_VENUE_LAYOUTS[variant];
  return <group name="buka-canteen-interior">
    <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onWalk([event.point.x, event.point.z]); }}>
      <planeGeometry args={[layout.width, layout.depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <Block at={[0, -0.1, 0]} size={[layout.width, 0.2, layout.depth]} tone="tileLight" color={floorColor} />
    <Block at={[0, 1.6, -layout.depth / 2]} size={[layout.width, 3.2, 0.16]} color={wallColor} />
    <Block at={[-layout.width / 2, 1.6, 0]} size={[0.16, 3.2, layout.depth]} color={wallColor} />
    <Block at={[layout.width / 2, 0.25, 0]} size={[0.16, 0.5, layout.depth]} color={wallColor} />
    <Block at={[0, 1.7, -4.35]} size={[5.8, 0.9, 0.06]} tone="tileBath" />
    <Block at={[3.8, 1.8, -4.35]} size={[1.6, 1.3, 0.08]} tone="glass" />
    {fixtures.map(f => <group key={f.id} position={[f.position[0], 0, f.position[1]]}
      onClick={event => { event.stopPropagation(); if (event.delta <= 5) onSelect(f.id); }}>
      {f.kind === "counter" ? <>
        <Block at={[0, 0.55, 0]} size={[5.6, 1.1, 1]} tone="clay" />
        <Block at={[0, 1.13, 0]} size={[5.8, 0.14, 1.15]} tone="tileLight" />
        {[-1.8, 0, 1.8].map(x => <group key={x} position={[x, 1.22, 0]}><CookingPot /></group>)}
        <Block at={[0, 2.55, -0.3]} size={[5.7, 0.18, 0.9]} tone="metal" />
      </> : f.kind === "table" ? <>
        <Block at={[0, 0.82, 0]} size={[3.2, 0.15, 1.1]} tone="timber" />
        {[-1.2, 1.2].map(x => <Block key={x} at={[x, 0.4, 0]} size={[0.14, 0.8, 0.85]} tone="metal" />)}
        {[-1, 1].map(side => <group key={side} position={[0, 0, side]}>
          <Block at={[0, 0.46, 0]} size={[3.1, 0.14, 0.48]} tone="timber" />
          {[-1.1, 1.1].map(x => <Block key={x} at={[x, 0.21, 0]} size={[0.12, 0.42, 0.4]} tone="metal" />)}
        </group>)}
      </> : <>
        <Block at={[0, 0.6, 0]} size={[1.2, 1.2, 0.85]} tone="concrete" />
        <mesh position={[0, 1.23, 0]}><cylinderGeometry args={[0.42, 0.25, 0.12, 16]} /><WorldMaterial tone="metal" /></mesh>
        <Block at={[0, 1.5, -0.35]} size={[0.07, 0.5, 0.07]} tone="metal" />
        <Block at={[0, 1.73, -0.17]} size={[0.07, 0.07, 0.4]} tone="metal" />
      </>}
      {f.id === selected && <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.93, 32]} /><meshBasicMaterial color={accentColor} />
      </mesh>}
    </group>)}
  </group>;
}
