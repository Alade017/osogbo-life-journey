import { useEffect, useState, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";

export interface InteractableZoneProps {
  id: string;
  promptLabel: string;
  position: [number, number, number];
  hitSize?: [number, number, number];
  ringRadius?: number;
  badgeHeight?: number;
  isInRange?: boolean;
  isTargeted?: boolean;
  onSelect: (id: string) => void;
  onHoverChange?: (id: string | null) => void;
  children?: ReactNode;
}

const BRASS_GOLD = "#F2B21C";

export function InteractableZone({
  id,
  promptLabel,
  position,
  hitSize = [2.0, 2.4, 2.0],
  ringRadius = 1.0,
  badgeHeight = 2.45,
  isInRange = false,
  isTargeted = false,
  onSelect,
  onHoverChange,
  children,
}: InteractableZoneProps) {
  const [hovered, setHovered] = useState(false);
  const { invalidate } = useThree();

  useEffect(() => {
    return () => {
      if (hovered && typeof document !== "undefined") {
        document.body.style.cursor = "auto";
      }
    };
  }, [hovered]);

  const highlighted = hovered || isInRange || isTargeted;

  useEffect(() => {
    invalidate();
  }, [highlighted, isInRange, isTargeted, invalidate]);

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    onHoverChange?.(id);
    if (typeof document !== "undefined") {
      document.body.style.cursor = "pointer";
    }
    invalidate();
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
    onHoverChange?.(null);
    if (typeof document !== "undefined") {
      document.body.style.cursor = "auto";
    }
    invalidate();
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(id);
  };

  const ringInner = ringRadius * 0.82;
  const ringOuter = highlighted ? ringRadius * 1.06 : ringRadius * 0.96;

  return (
    <group name={`interactable-zone-${id}`} position={position}>
      {children}

      {/* Soft brass-gold (#F2B21C) ground highlight ring & subtle inner aura */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.085, 0]} raycast={() => null}>
        <ringGeometry args={[ringInner, ringOuter, 32]} />
        <meshBasicMaterial
          color={BRASS_GOLD}
          transparent
          opacity={highlighted ? 0.94 : 0.36}
          depthWrite={false}
        />
      </mesh>
      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.082, 0]} raycast={() => null}>
          <circleGeometry args={[ringInner, 28]} />
          <meshBasicMaterial
            color={BRASS_GOLD}
            transparent
            opacity={isInRange ? 0.24 : 0.14}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Invisible click & hover hit volume */}
      <mesh
        position={[0, hitSize[1] / 2, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={hitSize} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Floating porcelain-and-blue world-space prompt badge */}
      {(isInRange || hovered || isTargeted) && (
        <Html
          center
          position={[0, badgeHeight, 0]}
          distanceFactor={16}
          style={{ pointerEvents: "auto" }}
        >
          <button
            type="button"
            className={`world-interact-badge${isInRange ? " is-in-range" : ""}${
              isTargeted ? " is-targeted" : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(id);
            }}
            aria-label={promptLabel}
          >
            <span className="world-interact-dot" aria-hidden="true" />
            <span>{promptLabel}</span>
            {isInRange && <kbd>E</kbd>}
          </button>
        </Html>
      )}
    </group>
  );
}
