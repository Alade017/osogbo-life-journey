/** Shared, static affordance: a quiet ring for usable props, a stronger ring for selection. */
export function InteractionMarker({
  color,
  selected,
  radius = 0.6,
  position = [0, 0.025, 0],
}: {
  color: string;
  selected: boolean;
  radius?: number;
  position?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[radius * (selected ? 0.8 : 0.9), radius, 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={selected ? 0.9 : 0.25}
        depthWrite={false}
      />
    </mesh>
  );
}
