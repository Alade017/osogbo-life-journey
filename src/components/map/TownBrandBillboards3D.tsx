import { SceneHtml } from "@/components/3d/SceneHtml";
import { useLayoutEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import layout from "@/data/osogbo-overview-layout.json";
import { WorldMaterial } from "@/components/3d/WorldScene";

function createBrandTexture(name: string, subtitle: string) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 288;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#233e68";
  context.fillRect(0, 0, 768, 288);
  context.fillStyle = "#e7c77f";
  context.fillRect(0, 0, 18, 288);
  context.textAlign = "center";
  context.fillStyle = "#faf7f0";
  context.font = "bold 60px system-ui";
  context.fillText(name, 396, 135, 690);
  context.font = "28px system-ui";
  context.fillStyle = "#d9e3ea";
  context.fillText(subtitle, 396, 198, 680);
  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  return result;
}

function BrandBoard({
  position,
  cell,
  texture,
  label,
}: {
  position: readonly [number, number];
  cell: number;
  texture: CanvasTexture | null;
  label?: string | undefined;
}) {
  return (
    <group position={[position[0], 0, position[1]]}>
      {label && (
        <SceneHtml
          position={[0, cell * 1.22, 0]}
          center
          pointerEvents="none"
          zIndexRange={[15, 10]}
        >
          <span className="overview-billboard-label">{label}</span>
        </SceneHtml>
      )}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * cell * 0.35, cell * 0.35, 0]} castShadow>
          <boxGeometry args={[0.1, cell * 0.7, 0.1]} />
          <WorldMaterial tone="metal" />
        </mesh>
      ))}
      <mesh position={[0, cell * 0.91, 0]} castShadow>
        <boxGeometry args={[cell * 1.12, cell * 0.44, 0.12]} />
        <WorldMaterial tone="indigo" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, cell * 0.91, side * 0.065]}
          rotation={[0, side === -1 ? Math.PI : 0, 0]}
        >
          <planeGeometry args={[cell * 1.08, cell * 0.405]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function TownBrandBillboards3D({
  positions,
  cell,
  showLabels = false,
}: {
  showLabels?: boolean;
  positions: readonly { id?: string; brandId?: string; position: readonly [number, number] }[];
  cell: number;
}) {
  const brands = layout.billboardPolicy.brands;
  const [textures, setTextures] = useState<ReadonlyMap<string, CanvasTexture | null>>(
    () => new Map(),
  );
  useLayoutEffect(() => {
    const owned = new Map(
      brands.map((brand) => [brand.id, createBrandTexture(brand.name, brand.subtitle)]),
    );
    setTextures(owned);
    return () => {
      for (const texture of owned.values()) texture?.dispose();
    };
  }, [brands]);
  return (
    <group>
      {positions.map((sign, index) => {
        const brand = sign.brandId
          ? brands.find((b) => b.id === sign.brandId)
          : brands[index % brands.length];
        if (!brand) return null;
        return (
          <BrandBoard
            key={sign.id ?? index}
            texture={textures.get(brand.id) ?? null}
            position={sign.position}
            cell={cell}
            label={showLabels ? `${brand.name} ${brand.subtitle}` : undefined}
          />
        );
      })}
    </group>
  );
}
