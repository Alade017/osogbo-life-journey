// src/components/game/map/MapPin.tsx
import { useRef, useEffect, FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import type { POI } from "@/store/mapSlice";

interface MapPinProps {
  poi: POI;
  selectedPoi?: POI | null;
  hoveredPoiId?: string | null;
  onSelect?: (poi: POI) => void;
  onHover?: (id: string | null) => void;
}

export const MapPin: FC<MapPinProps> = ({ poi, selectedPoi, hoveredPoiId, onSelect, onHover }) => {
  const groupRef = useRef<Group>(null);

  // Animation parameters
  const baseY = poi.position[1];
  const isSelected = selectedPoi?.id === poi.id;
  const isHovered = hoveredPoiId === poi.id;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const speed = isSelected ? 2.5 : 1.2;
    const amplitude = isSelected ? 0.5 : 0.2;
    const time = performance.now() * 0.001 * speed;
    groupRef.current.position.y = baseY + Math.sin(time) * amplitude;
    // Slight scale pulse when hovered
    const scale = isHovered ? 1.15 : 1;
    groupRef.current.scale.setScalar(scale);
  });

  // Pointer events (cursor handling)
  const handlePointerOver = () => {
    onHover?.(poi.id);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    onHover?.(null);
    document.body.style.cursor = "default";
  };

  const handleClick = () => {
    onSelect?.(poi);
  };

  // Cleanup cursor on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  return (
    <group
      ref={groupRef}
      position={poi.position as unknown as [number, number, number]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Sphere base */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={isSelected ? "#ffdd00" : isHovered ? "#ffd700" : "#ff9f00"} />
      </mesh>
      {/* Cone tip */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.15, 0.6, 8]} />
        <meshStandardMaterial color={isSelected ? "#ffdd00" : "#ff9f00"} />
      </mesh>
      {/* HTML tooltip */}
      <Html distanceFactor={10} style={{ pointerEvents: "none" }}>
        <div className="rounded-md bg-black/70 text-white text-sm font-medium px-2 py-1 backdrop-blur-sm select-none whitespace-nowrap">
          {poi.name}
        </div>
      </Html>
    </group>
  );
};
