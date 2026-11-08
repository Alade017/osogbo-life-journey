import { WorldHouse, WorldMaterial } from "@/components/3d/WorldScene";

/**
 * Compact, reusable compound for reserved residential plots in the town overview.
 * The simple geometry keeps the overview inexpensive while adding recognizable
 * local details: plaster boundary walls, a sliding gate and an elevated water tank.
 */
export function ResidentialCompound3D({
  position,
  size,
  variant = 0,
}: {
  position: [number, number, number];
  size: number;
  variant?: number;
}) {
  const wallHeight = size * 0.22;
  const wallThickness = size * 0.055;
  const houseWidth = size * 0.58;
  const houseDepth = size * 0.52;
  const gateWidth = size * 0.3;
  const roofColors = ["#9b5540", "#8b9298", "#b56b42", "#6f777c"];
  const roofColor = roofColors[variant % roofColors.length] ?? "#9b5540";

  return (
    <group position={position}>
      {/* Plot apron and four low perimeter walls; the front opening is the driveway. */}
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <boxGeometry args={[size * 0.94, 0.07, size * 0.94]} />
        <WorldMaterial tone="concrete" />
      </mesh>
      <mesh position={[-size * 0.45, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, size * 0.9]} />
        <WorldMaterial tone="wall" />
      </mesh>
      <mesh position={[size * 0.45, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, size * 0.9]} />
        <WorldMaterial tone="wall" />
      </mesh>
      <mesh position={[0, wallHeight / 2, -size * 0.45]}>
        <boxGeometry args={[size * 0.9, wallHeight, wallThickness]} />
        <WorldMaterial tone="wall" />
      </mesh>
      <mesh position={[-(gateWidth + wallThickness) / 2, wallHeight / 2, size * 0.45]}>
        <boxGeometry args={[(size * 0.9 - gateWidth) / 2, wallHeight, wallThickness]} />
        <WorldMaterial tone="wall" />
      </mesh>
      <mesh position={[(gateWidth + wallThickness) / 2, wallHeight / 2, size * 0.45]}>
        <boxGeometry args={[(size * 0.9 - gateWidth) / 2, wallHeight, wallThickness]} />
        <WorldMaterial tone="wall" />
      </mesh>

      {/* Sliding metal gate with simple vertical bars. */}
      <mesh position={[0, wallHeight * 0.48, size * 0.45]}>
        <boxGeometry args={[gateWidth, wallHeight * 0.72, wallThickness * 0.55]} />
        <WorldMaterial tone="metal" />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh key={`gate-bar-${index}`} position={[(index - 2) * gateWidth * 0.19, wallHeight * 0.48, size * 0.47]}>
          <boxGeometry args={[wallThickness * 0.28, wallHeight * 0.68, wallThickness * 0.25]} />
          <WorldMaterial tone="linen" />
        </mesh>
      ))}

      {/* Single-storey plaster bungalow, inset behind the compound entrance. */}
      <WorldHouse
        position={[0, 0.08, -size * 0.08]}
        width={houseWidth}
        depth={houseDepth}
        height={size * 0.34}
        detailed
        variant="residential"
      />
      <mesh position={[0, size * 0.46, -size * 0.08]}>
        <boxGeometry args={[houseWidth + 0.12, size * 0.045, houseDepth + 0.12]} />
        <WorldMaterial tone="accent" color={roofColor} />
      </mesh>

      {/* Elevated black water tank on a small concrete stand. */}
      <mesh position={[size * 0.28, size * 0.63, -size * 0.23]}>
        <boxGeometry args={[size * 0.12, size * 0.28, size * 0.12]} />
        <WorldMaterial tone="concrete" />
      </mesh>
      <mesh position={[size * 0.28, size * 0.82, -size * 0.23]}>
        <cylinderGeometry args={[size * 0.105, size * 0.105, size * 0.22, 12]} />
        <WorldMaterial tone="slate" color="#26343b" />
      </mesh>
      <mesh position={[size * 0.28, size * 0.94, -size * 0.23]}>
        <cylinderGeometry args={[size * 0.105, size * 0.105, size * 0.025, 12]} />
        <WorldMaterial tone="slate" color="#18252c" />
      </mesh>
    </group>
  );
}
