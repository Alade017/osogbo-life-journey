import { Suspense } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { WorldMaterial } from "./WorldScene";
import type { WorldTone } from "./world-theme";
import { VenueSceneBoundary } from "@/components/game/VenueSceneBoundary";
import { SHOWROOM_LAYOUT as layout, SHOWROOM_BAYS, SHOWROOM_RECEPTION as desk } from "@/game/showroom-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";

type Point = [number, number, number];
type Display = { id: string; url: string };
function Block({ at, size, tone = "wall" }: { at: Point; size: Point; tone?: WorldTone }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><WorldMaterial tone={tone} /></mesh>;
}
function Glass({ at, size }: { at: Point; size: Point }) {
  return <mesh position={at}><boxGeometry args={size} /><meshStandardMaterial color="#b6d7df" transparent opacity={0.22} roughness={0.18} depthWrite={false} /></mesh>;
}
function Vehicle({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} />;
}
const height = 4;
const entranceWidth = 3;
const front = layout.depth / 2;
const halfWidth = layout.width / 2;

export function DealershipFacade({ onEnter }: { onEnter?: () => void }) {
  return <group name="dealership-facade">
    {[-1, 1].map((side) => {
      const width = halfWidth - entranceWidth / 2;
      const x = side * (halfWidth + entranceWidth / 2) / 2;
      return <group key={side}>
        <Glass at={[x, 1.7, front]} size={[width, 3.4, 0.08]} />
        {[0, 0.5, 1].map((fraction) => <Block key={fraction} at={[side * (entranceWidth / 2 + fraction * width), 1.7, front]} size={[0.14, 3.4, 0.2]} tone="windowFrame" />)}
        <Block at={[x, 0.12, front]} size={[width, 0.24, 0.2]} tone="metal" />
      </group>;
    })}
    <Block at={[0, 3.7, front]} size={[layout.width, 0.6, 0.35]} tone="slate" />
    <Block at={[0, 3.3, front + 0.9]} size={[entranceWidth + 1.2, 0.16, 2]} tone="metal" />
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onEnter?.(); }}>
      <Block at={[0, -0.08, front + 0.6]} size={[entranceWidth, 0.16, 1.2]} tone="path" />
    </group>
  </group>;
}

export function DealershipExterior({ onEnter }: { onEnter?: () => void }) {
  return <group name="dealership-exterior">
    <Block at={[0, -0.25, 2]} size={[layout.width + 8, 0.3, layout.depth + 10]} tone="sidewalk" />
    <Block at={[0, -0.08, front + 4.5]} size={[layout.width + 8, 0.18, 5]} tone="road" />
    <Block at={[0, height / 2, -front]} size={[layout.width, height, 0.2]} />
    {[-1, 1].map((side) => <Block key={side} at={[side * halfWidth, height / 2, 0]} size={[0.2, height, layout.depth]} />)}
    <Block at={[0, height, 0]} size={[layout.width + 0.4, 0.25, layout.depth + 0.4]} tone="slate" />
    <DealershipFacade {...(onEnter ? { onEnter } : {})} />
  </group>;
}

export function DealershipInterior({ models, onWalk, onSelect }: {
  models: readonly Display[];
  onWalk: (point: WalkPoint) => void;
  onSelect: (index: number) => void;
}) {
  return <group name="dealership-interior">
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onWalk([event.point.x, event.point.z]); }}>
      <Block at={[0, -0.1, 0]} size={[layout.width, 0.2, layout.depth]} tone="tileLight" />
      <Block at={[0, 0.012, 0]} size={[2, 0.024, layout.depth - 0.3]} tone="linen" />
    </group>
    <Block at={[0, height / 2, -front]} size={[layout.width, height, 0.2]} />
    <Block at={[-halfWidth, height / 2, 0]} size={[0.2, height, layout.depth]} />
    <Block at={[halfWidth, 0.18, 0]} size={[0.2, 0.36, layout.depth]} tone="metal" />
    <Block at={[0, 0.12, front]} size={[layout.width, 0.24, 0.12]} tone="metal" />
    {[-1, 1].map((side) => <Block key={side} at={[side * entranceWidth / 2, 0.5, front]} size={[0.15, 1, 0.15]} tone="windowFrame" />)}
    <group position={[desk.x, 0, desk.z]} name="reception">
      <Block at={[0, 0.52, 0]} size={[desk.width - 0.1, 1.04, desk.depth - 0.1]} tone="timber" />
      <Block at={[0, 1.08, 0]} size={[desk.width, 0.08, desk.depth]} tone="linen" />
      <Block at={[0.7, 1.33, -0.15]} size={[0.65, 0.4, 0.08]} tone="slate" />
    </group>
    {SHOWROOM_BAYS.map((bay, index) => {
      const model = models[index];
      return <group key={index} position={[bay.x, 0, bay.z]} onClick={(event) => { event.stopPropagation(); if (model && event.delta <= 5) onSelect(index); }}>
        <Block at={[0, 0.08, 0]} size={[layout.displayWidth, 0.16, layout.displayDepth]} tone="tileShade" />
        {model && <group position={[0, 0.16, 0]}>
          <VenueSceneBoundary key={model.id} fallback={null}><Suspense fallback={null}><Vehicle url={model.url} /></Suspense></VenueSceneBoundary>
        </group>}
      </group>;
    })}
  </group>;
}
