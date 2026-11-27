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

export function MapBillboardModel({
  cell,
  texture,
}: {
  cell: number;
  texture?: CanvasTexture | null;
}) {
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * cell * 0.38, 0, 0.16 * cell]}>
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[cell * 0.19, 0.07, cell * 0.18]} />
            <WorldMaterial tone="concrete" />
          </mesh>
          <mesh position={[0, cell * 0.44, 0]}>
            <boxGeometry args={[cell * 0.07, cell * 0.86, cell * 0.07]} />
            <WorldMaterial tone="slate" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, cell * 0.85, cell * 0.06]}>
        <boxGeometry args={[cell * 0.9, cell * 0.06, cell * 0.26]} />
        <WorldMaterial tone="metal" />
      </mesh>
      <group
        name="billboard-face"
        position={[0, cell * 0.99, -cell * 0.08]}
        rotation={[-Math.PI * 0.3, 0, 0]}
      >
        <mesh>
          <boxGeometry args={[cell * 1.12, cell * 0.51, 0.12]} />
          <WorldMaterial tone="indigo" />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <planeGeometry args={[cell * 1.08, cell * 0.47]} />
          <meshBasicMaterial
            map={texture ?? null}
            color={texture ? "#ffffff" : "#38577d"}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}

export function TownBrandBillboards3D({
  positions,
  cell,
  onSelect,
}: {
  onSelect?: ((id: string, delta: number) => void) | undefined;
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
          <group
            key={sign.id ?? index}
            name={`overview-billboard:${sign.id ?? index}`}
            position={[sign.position[0], 0, sign.position[1]]}
            onClick={(event) => {
              if (!onSelect) return;
              event.stopPropagation();
              onSelect(brand.id, event.delta);
            }}
          >
            <MapBillboardModel cell={cell} texture={textures.get(brand.id) ?? null} />
          </group>
        );
      })}
    </group>
  );
}
