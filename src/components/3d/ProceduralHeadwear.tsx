import type { JSX } from "react";

type HeadwearStyle = 0 | 1 | 2 | 3;

/**
 * Lightweight procedural Yoruba and everyday headwear.
 * Coordinates are local to the existing head bone; no rig changes are required.
 */
export function ProceduralHeadwear({
  style,
  color,
}: {
  style: HeadwearStyle;
  color: string;
}) {
  if (style === 0) return null;

  const accent = "#e9dfc8";
  return (
    <group position={[0, 0.12, 0]} name="procedural-headwear">
      {style === 1 ? (
        // Gele: layered fabric folds with a broad, sculptural silhouette.
        <group name="yoruba-gele" rotation={[0.04, 0, -0.025]}>
          <mesh position={[0, 0.018, -0.006]} scale={[1.04, 0.78, 0.88]} castShadow>
            <sphereGeometry args={[0.105, 20, 12]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.047, -0.012]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.073, 0.018, 8, 28]} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.074, -0.018]} rotation={[Math.PI / 2, 0, 0.12]} castShadow>
            <torusGeometry args={[0.058, 0.014, 8, 24]} />
            <meshStandardMaterial color={accent} roughness={0.88} />
          </mesh>
          <mesh position={[-0.088, 0.038, -0.018]} rotation={[0.1, 0, -0.42]} scale={[1.1, 0.7, 0.72]} castShadow>
            <sphereGeometry args={[0.064, 16, 10]} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
          <mesh position={[0.088, 0.038, -0.018]} rotation={[-0.1, 0, 0.42]} scale={[1.1, 0.7, 0.72]} castShadow>
            <sphereGeometry args={[0.064, 16, 10]} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.028, 0.075]} scale={[0.88, 0.48, 0.32]} castShadow>
            <sphereGeometry args={[0.055, 16, 10]} />
            <meshStandardMaterial color={accent} roughness={0.9} />
          </mesh>
        </group>
      ) : style === 2 ? (
        // Fila: a close-fitting, softly rounded Yoruba cap.
        <group name="yoruba-fila" rotation={[0, 0, -0.035]}>
          <mesh position={[0, 0.026, 0]} castShadow>
            <cylinderGeometry args={[0.094, 0.102, 0.052, 24, 1]} />
            <meshStandardMaterial color={color} roughness={0.94} />
          </mesh>
          <mesh position={[0, 0.047, -0.006]} scale={[1, 0.48, 0.96]} castShadow>
            <sphereGeometry args={[0.094, 20, 12]} />
            <meshStandardMaterial color={color} roughness={0.94} />
          </mesh>
          <mesh position={[0, 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.096, 0.006, 6, 24]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
        </group>
      ) : (
        // Everyday cap with a crown and forward-facing brim.
        <group name="everyday-cap" rotation={[-0.035, 0, 0]}>
          <mesh position={[0, 0.034, -0.004]} scale={[1, 0.72, 0.96]} castShadow>
            <sphereGeometry args={[0.098, 20, 12]} />
            <meshStandardMaterial color={color} roughness={0.86} />
          </mesh>
          <mesh position={[0, 0.012, 0.066]} rotation={[-0.12, 0, 0]} scale={[1, 0.22, 1.45]} castShadow>
            <sphereGeometry args={[0.065, 20, 10]} />
            <meshStandardMaterial color={color} roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.018, -0.008]}>
            <cylinderGeometry args={[0.094, 0.094, 0.012, 24]} />
            <meshStandardMaterial color={accent} roughness={0.85} />
          </mesh>
        </group>
      )}
    </group>
  );
}
