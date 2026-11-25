import { ShowroomAsset } from "./ShowroomAsset";
import { useMemo } from "react";
import { WorldMaterial, WorldInstances, type WorldInstance } from "./WorldScene";
import type { WorldTone } from "./world-theme";
import { type ShowroomLayout } from "@/game/showroom-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";

type Point = [number, number, number];
type Display = { id: string; url: string };
export type DealershipStyle = "standard" | "exotic";
const finishes = {
  standard: { wall: "#e5e1d8", fascia: "#334155", floor: "#dedbd3", platform: "#a6adb2", accent: "#376b75", trim: "#76838b" },
  exotic: { wall: "#343940", fascia: "#161b23", floor: "#555b61", platform: "#242a32", accent: "#c4a36b", trim: "#b7a078" },
} as const;
function Block({ at, size, tone = "wall", color }: { at: Point; size: Point; tone?: WorldTone; color?: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><WorldMaterial tone={tone} color={color} /></mesh>;
}
function Glass({ at, size }: { at: Point; size: Point }) {
  return <mesh position={at}><boxGeometry args={size} /><meshStandardMaterial color="#b6d7df" transparent opacity={0.22} roughness={0.18} depthWrite={false} /></mesh>;
}
const height = 4;


export function DealershipFacade({ layout, onEnter, style = "standard" }: { layout: ShowroomLayout; onEnter?: () => void; style?: DealershipStyle }) {
  const finish = finishes[style];
  const front = layout.depth / 2;
  const halfWidth = layout.width / 2;
  return <group name="dealership-facade">
    {[-1, 1].map((side) => {
      const width = halfWidth - layout.entranceWidth / 2;
      const x = side * (halfWidth + layout.entranceWidth / 2) / 2;
      return <group key={side}>
        <Glass at={[x, 1.7, front]} size={[width, 3.4, 0.08]} />
        {[0, 0.5, 1].map((fraction) => <Block key={fraction} at={[side * (layout.entranceWidth / 2 + fraction * width), 1.7, front]} size={[0.14, 3.4, 0.2]} tone="windowFrame" />)}
        <Block at={[x, 0.12, front]} size={[width, 0.24, 0.2]} tone="metal" />
      </group>;
    })}
    <Block at={[0, 3.7, front]} size={[layout.width, 0.6, 0.35]} tone="slate" color={finish.fascia} />
    <Block at={[0, 3.3, front + 0.9]} size={[layout.entranceWidth + 1.2, 0.16, 2]} tone="metal" />
    <Block at={[0, 3.43, front + 0.19]} size={[layout.width, 0.08, 0.05]} tone="metal" color={finish.accent} />
    {style === "exotic" && [-1, 1].map((side) => <Block key={side} at={[side * 7.65, 1.8, front + 0.12]} size={[0.32, 3.6, 0.32]} tone="metal" color={finish.trim} />)}
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onEnter?.(); }}>
      <Block at={[0, -0.08, front + 0.6]} size={[layout.entranceWidth, 0.16, 1.2]} tone="path" />
    </group>
  </group>;
}

export function DealershipExterior({ layout, onEnter, onWalk, style = "standard" }: { layout: ShowroomLayout; onEnter?: () => void; onWalk: (point: WalkPoint) => void; style?: DealershipStyle }) {
  const finish = finishes[style];
  const front = layout.depth / 2;
  const halfWidth = layout.width / 2;
  return <group name="dealership-exterior">
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onWalk([event.point.x, event.point.z]); }}>
      <Block at={[0, -0.1, front + 1.5]} size={[layout.width, 0.2, 3]} tone="sidewalk" />
    </group>
    <Block at={[0, -0.08, front + 4.5]} size={[layout.width + 8, 0.18, 5]} tone="road" />
    <Block at={[0, height / 2, -front]} size={[layout.width, height, 0.2]} color={finish.wall} />
    {[-1, 1].map((side) => <Block key={side} at={[side * halfWidth, height / 2, 0]} size={[0.2, height, layout.depth]} color={finish.wall} />)}
    <Block at={[0, height, 0]} size={[layout.width + 0.4, 0.25, layout.depth + 0.4]} tone="slate" color={finish.fascia} />
    <DealershipFacade layout={layout} style={style} {...(onEnter ? { onEnter } : {})} />
  </group>;
}

export function DealershipInterior({ layout, models, onWalk, onSelect, onExit, style = "standard", activeBay, onAssetReady, onAssetError, onAssetUnmounted, attempts, viewer, loadRadius }: {
  loadRadius: number;
  layout: ShowroomLayout;
  viewer: WalkPoint;
  models: readonly Display[];
  onWalk: (point: WalkPoint) => void;
  onSelect: (index: number) => void;
  onExit: () => void;
  style?: DealershipStyle;
  activeBay?: number | null;
  onAssetReady: (id: string) => void;
  onAssetError: (id: string) => void;
  onAssetUnmounted: (id: string) => void;
  attempts: Readonly<Record<string, number>>;
}) {
  const finish = finishes[style];
  const front = layout.depth / 2;
  const halfWidth = layout.width / 2;
  const platforms = useMemo(() => layout.bays.map(bay => ({
    position: [bay.x, 0.08, bay.z],
    scale: [layout.displayWidth, 0.16, layout.displayDepth],
  } satisfies WorldInstance)), [layout]);
  return <group name="dealership-interior">
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onWalk([event.point.x, event.point.z]); }}>
      <Block at={[0, -0.1, 0]} size={[layout.width, 0.2, layout.depth]} tone="tileLight" color={finish.floor} />
      <Block at={[0, 0.012, 0]} size={[2, 0.024, layout.depth - 0.3]} tone="linen" color={finish.trim} />
    </group>
    <Block at={[0, height / 2, -front]} size={[layout.width, height, 0.2]} />
    <Block at={[-halfWidth, height / 2, 0]} size={[0.2, height, layout.depth]} />
    <Block at={[halfWidth, 0.18, 0]} size={[0.2, 0.36, layout.depth]} tone="metal" />
    {[-1, 1].map((side) => <Block key={side} at={[side * (halfWidth + layout.entranceWidth / 2) / 2, 0.12, front]} size={[halfWidth - layout.entranceWidth / 2, 0.24, 0.12]} tone="metal" />)}
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 5) onExit(); }}>
      <Block at={[0, 0.025, front - 0.5]} size={[layout.entranceWidth, 0.05, 1]} tone="path" />
    </group>
    {[-1, 1].map((side) => <Block key={side} at={[side * layout.entranceWidth / 2, 0.5, front]} size={[0.15, 1, 0.15]} tone="windowFrame" />)}
    <group position={[layout.reception.x, 0, layout.reception.z]} name="reception">
      <Block at={[0, 0.52, 0]} size={[layout.reception.width - 0.1, 1.04, layout.reception.depth - 0.1]} tone="timber" />
      <Block at={[0, 1.08, 0]} size={[layout.reception.width, 0.08, layout.reception.depth]} tone="linen" color={finish.trim} />
      <Block at={[0.7, 1.33, -0.15]} size={[0.65, 0.4, 0.08]} tone="slate" />
    </group>
    {style === "exotic" && [-5.5, -2.75, 0, 2.75, 5.5].map((x) => <group key={x}>
      <Block at={[x, 2.1, -front + 0.13]} size={[0.09, 3.6, 0.08]} tone="metal" color={finish.trim} />
      <mesh position={[x + 0.35, 2.9, -front + 0.16]}><boxGeometry args={[0.5, 0.035, 0.06]} /><meshBasicMaterial color="#fff0cf" /></mesh>
    </group>)}
    <group onClick={(event) => {
      event.stopPropagation();
      const index = event.instanceId;
      if (event.delta <= 5 && index !== undefined && models[index]) onSelect(index);
    }}>
      <WorldInstances items={platforms} tone="tileShade" color={finish.platform} />
    </group>
    {layout.bays.map((bay, index) => {
      const model = models[index];
      return <group key={index} position={[bay.x, 0, bay.z]} onClick={(event) => { event.stopPropagation(); if (model && event.delta <= 5) onSelect(index); }}>
        {(style === "exotic" || activeBay === index) && [-1, 1].map((side) => <group key={side}>
          <mesh position={[side * (layout.displayWidth / 2 - 0.045), 0.169, 0]}><boxGeometry args={[0.045, 0.012, layout.displayDepth - 0.08]} /><meshBasicMaterial color={finish.accent} /></mesh>
          <mesh position={[0, 0.169, side * (layout.displayDepth / 2 - 0.045)]}><boxGeometry args={[layout.displayWidth - 0.08, 0.012, 0.045]} /><meshBasicMaterial color={finish.accent} /></mesh>
        </group>)}
        {model && <group position={[0, 0.16, 0]}>
          <ShowroomAsset attempt={attempts[model.id] ?? 0} product={model} viewer={viewer} position={[bay.x, bay.z]} radius={loadRadius} pinned={activeBay === index} limits={[layout.displayWidth - 0.2, 3.5, layout.displayDepth - 0.2]} onReady={onAssetReady} onError={onAssetError} onUnmount={onAssetUnmounted} />
        </group>}
      </group>;
    })}
  </group>;
}
