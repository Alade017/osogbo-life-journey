import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";

function BrandBoard({
  name,
  subtitle,
  position,
  cell,
}: {
  name: string;
  subtitle: string;
  position: readonly [number, number];
  cell: number;
}) {
  const texture = useMemo(() => {
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
  }, [name, subtitle]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <group position={[position[0], 0, position[1]]}>
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
      <mesh position={[0, cell * 0.91, 0.065]}>
        <planeGeometry args={[cell * 1.08, cell * 0.405]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function TownBrandBillboards3D({
  positions,
  cell,
}: {
  positions: readonly { position: readonly [number, number] }[];
  cell: number;
}) {
  const brands = [
    { name: "ALADTECH", subtitle: "Web Solutions" },
    { name: "Wlegance", subtitle: "Tech Hub" },
  ];
  return (
    <group>
      {positions.slice(0, 2).map((sign, index) => (
        <BrandBoard
          key={brands[index].name}
          {...brands[index]}
          position={sign.position}
          cell={cell}
        />
      ))}
    </group>
  );
}
