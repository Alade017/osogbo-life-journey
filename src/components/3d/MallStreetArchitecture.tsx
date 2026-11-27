import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { STREET_DOOR, STREET_OBSTACLES } from "@/game/osun-mall-street-layout";
import { WorldMaterial } from "./WorldScene";
import { SceneBoxGeometryProvider, useSceneBoxGeometry } from "./scene-box-geometries";
import { WORLD_PALETTE, type WorldTone } from "./world-theme";

type Point = [number, number, number];
function Box({
  position,
  size,
  tone = "concrete",
  color,
}: {
  position: Point;
  size: Point;
  tone?: WorldTone;
  color?: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <primitive object={useSceneBoxGeometry(size)} attach="geometry" dispose={null} />
      <WorldMaterial tone={tone} color={color} />
    </mesh>
  );
}
function MallSign() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#f5c86c";
    context.fillRect(0, 0, 768, 128);
    context.fillStyle = "#304357";
    context.font = "bold 76px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("OSUN MALL", 384, 65);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh position={[0, 3.9, -4.47]}>
      <planeGeometry args={[7.5, 1.05]} />
      <meshStandardMaterial
        color={texture ? "white" : WORLD_PALETTE.sign}
        map={texture}
        roughness={0.8}
      />
    </mesh>
  );
}
function Tree({ x }: { x: number }) {
  return (
    <group position={[x, 0, -3.7]}>
      <Box position={[0, 0.22, 0]} size={[1.1, 0.44, 1.1]} tone="clay" />
      <Box position={[0, 1.2, 0]} size={[0.18, 2, 0.18]} tone="timber" />
      {[-0.3, 0.3].map((offset, i) => (
        <mesh key={offset} position={[offset, 2.3 + i * 0.25, 0]} castShadow>
          <icosahedronGeometry args={[0.75, 1]} />
          <WorldMaterial tone="foliage" />
        </mesh>
      ))}
    </group>
  );
}
function Contents({ onEnterMall }: { onEnterMall: () => void }) {
  return (
    <group name="osun-mall-street-architecture">
      <Box position={[0, 2.1, -5.75]} size={[20, 4.2, 2.4]} color="#e6bc78" />
      <Box position={[0, 4.3, -5.7]} size={[20.3, 0.3, 2.7]} tone="indigo" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box position={[side * 3.9, 1.9, -4.48]} size={[0.7, 3.8, 0.6]} color="#df812d" />
          <Box position={[side * 6.6, 1.9, -4.48]} size={[3.6, 2.6, 0.09]} tone="glass" />
          {[-1, 0, 1].map((mullion) => (
            <Box
              key={mullion}
              position={[side * 6.6 + mullion, 1.9, -4.4]}
              size={[0.07, 2.6, 0.07]}
              tone="metal"
            />
          ))}
        </group>
      ))}
      <Box position={[0, 3.25, -4.1]} size={[8.6, 0.24, 1.2]} color="#e49339" />
      <MallSign />
      <group
        position={[STREET_DOOR[0], 0, STREET_DOOR[1]]}
        onClick={(event) => {
          if (event.delta > 5) return;
          event.stopPropagation();
          onEnterMall();
        }}
        name="mall-entry-door"
      >
        <Box position={[0, 1.4, 0]} size={[3.1, 2.8, 0.12]} tone="glass" />
        {[-1.5, 0, 1.5].map((x) => (
          <Box key={x} position={[x, 1.4, 0.08]} size={[0.08, 2.85, 0.1]} tone="metal" />
        ))}
        {[-0.18, 0.18].map((x) => (
          <Box key={x} position={[x, 1.2, 0.15]} size={[0.05, 0.55, 0.08]} tone="metal" />
        ))}
      </group>
      <Box position={[0, 0.035, -3.9]} size={[3.5, 0.06, 0.8]} tone="concrete" />
      {STREET_OBSTACLES.filter((rect) => rect.id.startsWith("front-rail")).map((rect) => {
        const width = rect.maxX - rect.minX,
          x = (rect.minX + rect.maxX) / 2,
          z = (rect.minZ + rect.maxZ) / 2;
        return (
          <group key={rect.id} name={rect.id}>
            {[0.22, 0.9].map((y) => (
              <Box key={y} position={[x, y, z]} size={[width, 0.06, 0.06]} tone="metal" />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <Box
                key={i}
                position={[rect.minX + (i * width) / 8, 0.5, z]}
                size={[0.07, 1, 0.07]}
                tone="windowFrame"
              />
            ))}
          </group>
        );
      })}
      {[-3, 0.6].map((z) => (
        <group key={z}>
          <Box position={[0, 0.025, z]} size={[20, 0.05, 0.2]} tone="sidewalk" />
          {Array.from({ length: 35 }, (_, i) => (
            <Box
              key={i}
              position={[-9.8 + i * 0.57, 0.035, z + 0.18]}
              size={[0.3, 0.02, 0.1]}
              tone="drainage"
            />
          ))}
        </group>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <Box
          key={i}
          position={[-9 + i * 2.6, 0.023, -1.2]}
          size={[1.2, 0.012, 0.07]}
          tone="roadMarking"
        />
      ))}
      <Tree x={-9.5} />
      <Tree x={9.5} />
      {STREET_OBSTACLES.filter((rect) => !rect.id.startsWith("front-rail")).map((rect) => {
        const width = rect.maxX - rect.minX,
          depth = rect.maxZ - rect.minZ,
          x = (rect.minX + rect.maxX) / 2,
          z = (rect.minZ + rect.maxZ) / 2;
        return (
          <group key={rect.id} name={rect.id}>
            <Box position={[x, 0.5, z]} size={[width, 1, depth]} tone="timber" />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                position={[x + side * (width / 2 - 0.08), 1.5, z]}
                size={[0.12, 2, 0.12]}
                tone="metal"
              />
            ))}
            <Box position={[x, 2.5, z]} size={[width + 0.3, 0.08, depth + 0.35]} tone="roof" />
            {Array.from({ length: 8 }, (_, i) => (
              <Box
                key={i}
                position={[x - width / 2 + (i * width) / 7, 2.56, z]}
                size={[0.035, 0.03, depth + 0.35]}
                tone="roofLight"
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
/** Architecture follows the same footprints used by street collision/pathfinding. */
export function MallStreetArchitecture(props: { onEnterMall: () => void }) {
  return (
    <SceneBoxGeometryProvider>
      <Contents {...props} />
    </SceneBoxGeometryProvider>
  );
}
