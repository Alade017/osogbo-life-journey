import { ShowroomAsset } from "./ShowroomAsset";
import { useMemo } from "react";
import { WorldMaterial, WorldInstances, type WorldInstance } from "./WorldScene";
import type { WorldTone } from "./world-theme";
import { RETAIL_ROOM as room, RETAIL_COUNTER as counter, RETAIL_EXTERIOR as exterior, type RetailDisplay } from "@/game/electronics-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";

type Point = [number, number, number];
type Product = { id: string; url: string };
function Block({ at, size, tone }: { at: Point; size: Point; tone: WorldTone }) {
  return <mesh position={at} receiveShadow castShadow><boxGeometry args={size} /><WorldMaterial tone={tone} /></mesh>;
}
export function ElectronicsEnvironment({ displays, products, onWalk, onSelect, onExit, selected, computerStore, onAssetReady, onAssetError, onAssetUnmounted, attempts, viewer, loadRadius }: {
  viewer: WalkPoint;
  loadRadius: number;
  displays: readonly RetailDisplay[];
  products: readonly Product[];
  onWalk: (point: WalkPoint) => void;
  onSelect: (index: number) => void;
  onExit: () => void;
  selected: number | null;
  computerStore: boolean;
  onAssetReady: (id: string) => void;
  onAssetError: (id: string) => void;
  onAssetUnmounted: (id: string) => void;
  attempts: Readonly<Record<string, number>>;
}) {
  const front = room.depth / 2;
  const legs = useMemo(() => displays.flatMap(display => [-1, 1].flatMap(x => [-1, 1].map(z => ({
    position: [display.x + x * (display.width / 2 - 0.12), 0.38, display.z + z * (display.depth / 2 - 0.1)],
    scale: [0.1, 0.76, 0.1],
  } satisfies WorldInstance)))), [displays]);
  return <group name="electronics-retail-interior">
    <group onClick={(e) => { e.stopPropagation(); if (e.delta <= 5) onWalk([e.point.x, e.point.z]); }}>
      <Block at={[0,-0.1,0]} size={[room.width,0.2,room.depth]} tone="tileLight" />
      <Block at={[0,0.012,0]} size={[2.8,0.024,room.depth-0.2]} tone="linen" />
    </group>
    <Block at={[0,1.8,-front]} size={[room.width,3.6,0.15]} tone="wall" />
    <Block at={[-room.width/2,1.8,0]} size={[0.15,3.6,room.depth]} tone="wall" />
    <Block at={[room.width/2,0.15,0]} size={[0.15,0.3,room.depth]} tone="trim" />
    {[-1,1].map(side => <group key={side}>
      <Block at={[side*(room.width+room.entranceWidth)/4,0.12,front]} size={[(room.width-room.entranceWidth)/2,0.24,0.12]} tone="metal" />
      <Block at={[side*room.entranceWidth/2,0.65,front]} size={[0.12,1.3,0.12]} tone="windowFrame" />
    </group>)}
    <group onClick={(e) => { e.stopPropagation(); if(e.delta<=5) onExit(); }}>
      <Block at={[0,0.025,front-0.5]} size={[room.entranceWidth,0.05,1]} tone="path" />
    </group>
    <group position={[counter.x,0,counter.z]}>
      <Block at={[0,0.5,0]} size={[counter.width-0.1,1,counter.depth-0.1]} tone="timber" />
      <Block at={[0,1.03,0]} size={[counter.width,0.06,counter.depth]} tone="linen" />
    </group>
    <group onClick={event => { event.stopPropagation(); if (event.delta <= 5 && event.instanceId !== undefined) onSelect(Math.floor(event.instanceId / 4)); }}>
      <WorldInstances items={legs} tone="metal" />
    </group>
    {displays.map((display,index) => {
      const product = products[index];
      if (!product) return null;
      return <group key={product.id} position={[display.x,0,display.z]} onClick={(e) => { e.stopPropagation(); if(e.delta<=5) onSelect(index); }}>
        <Block at={[0,0.83,0]} size={[display.width,0.12,display.depth]} tone={computerStore ? "timber" : "slate"} />
        <group position={[0,0.89,0]} rotation={[0,display.x<0?Math.PI/2:-Math.PI/2,0]}>
          <ShowroomAsset attempt={attempts[product.id] ?? 0} product={product} viewer={viewer} position={[display.x, display.z]} radius={loadRadius} pinned={selected === index} limits={[Math.min(1.35, display.depth - 0.1), 1.25, 0.85]} onReady={onAssetReady} onError={onAssetError} onUnmount={onAssetUnmounted} />
        </group>
        {selected===index && <mesh position={[0,0.898,display.depth/2-0.025]}><boxGeometry args={[display.width,0.012,0.04]} /><meshBasicMaterial color="#c47c45" /></mesh>}
      </group>;
    })}
  </group>;
}

export function ElectronicsExterior({ onWalk, onEnter }: { onWalk: (point: WalkPoint) => void; onEnter: () => void }) {
  const front = room.depth / 2;
  const windowWidth = (room.width - room.entranceWidth) / 2;
  const wallHeight = 3.6;
  return <group name="electronics-storefront">
    <group onClick={event => { event.stopPropagation(); if (event.delta <= 5) onWalk([event.point.x, event.point.z]); }}>
      <Block at={[0, -0.1, front + exterior.depth / 2]} size={[room.width, 0.2, exterior.depth]} tone="sidewalk" />
    </group>
    <Block at={[0, -0.1, front + exterior.depth + 2.5]} size={[room.width + 6, 0.18, 5]} tone="road" />
    <Block at={[0, wallHeight / 2, -front]} size={[room.width, wallHeight, 0.16]} tone="wall" />
    {[-1, 1].map(side => <group key={side}>
      <Block at={[side * room.width / 2, wallHeight / 2, 0]} size={[0.16, wallHeight, room.depth]} tone="wall" />
      <Block at={[side * (room.entranceWidth + windowWidth) / 2, 0.35, front]} size={[windowWidth, 0.7, 0.2]} tone="slate" />
      <mesh position={[side * (room.entranceWidth + windowWidth) / 2, 1.85, front]}>
        <boxGeometry args={[windowWidth, 2.3, 0.08]} />
        <meshStandardMaterial color="#819ba8" roughness={0.22} metalness={0.25} />
      </mesh>
      {[0, 0.5, 1].map(fraction => <Block key={fraction} at={[side * (room.entranceWidth / 2 + fraction * windowWidth), 1.85, front]} size={[0.12, 2.3, 0.16]} tone="windowFrame" />)}
    </group>)}
    <Block at={[0, wallHeight, 0]} size={[room.width + 0.3, 0.24, room.depth + 0.3]} tone="roof" />
    <Block at={[0, 3.28, front + 0.12]} size={[room.width, 0.62, 0.24]} tone="slate" />
    <Block at={[0, 3.02, front + 0.7]} size={[room.entranceWidth + 1, 0.14, 1.5]} tone="metal" />
    <group onClick={event => { event.stopPropagation(); if (event.delta <= 5) onEnter(); }}>
      <Block at={[0, -0.05, front + 0.5]} size={[room.entranceWidth, 0.1, 1]} tone="path" />
    </group>
  </group>;
}
