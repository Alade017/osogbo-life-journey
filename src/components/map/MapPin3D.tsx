import { useId, useRef, useState, type FC } from "react";
import type { Group } from "three";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";
import { useMapMarkerLayout } from "./map-marker-registry";
import { placeBadgeFor } from "./map-badge";

export interface MapPin3DProps {
  position: [number, number, number];
  label: string;
  category: string;
  isLocked?: boolean;
  lockReason?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  showName?: boolean;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

/** Screen-sized category badge anchored to a 3D destination, with names on focus. */
export const MapPin3D: FC<MapPin3DProps> = ({
  position,
  label,
  category,
  isLocked = false,
  lockReason,
  isSelected = false,
  isHovered = false,
  showName = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const pinGroupRef = useRef<Group>(null);
  const badgeInfo = placeBadgeFor(category);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const markerId = useId();
  useMapMarkerLayout(markerId, { group: pinGroupRef, button: buttonRef, selected: isSelected });

  const pinColor = isLocked ? "#82705d" : badgeInfo.tone;
  const [hovered, setHovered] = useState(false);
  const showLabel = showName || isSelected || isHovered || hovered;
  return (
    <group
      position={[position[0], position[1] + 1.1, position[2]]}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta <= 5) onClick?.();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onPointerOver?.();
      }}
      onPointerOut={() => {
        setHovered(false);
        onPointerOut?.();
      }}
    >
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.8, 6]} />
        <meshStandardMaterial color={pinColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.3, 24]} />
        <meshBasicMaterial color={pinColor} />
      </mesh>
      <group ref={pinGroupRef} position={[0, 0.4, 0]}>
        <Html center zIndexRange={[20, 0]}>
          <button
            ref={buttonRef}
            type="button"
            className="map-location-marker"
            aria-label={`${label}${isLocked ? " (Locked)" : ""}`}
            aria-pressed={isSelected}
            style={{ borderColor: pinColor }}
            onClick={(event) => {
              event.stopPropagation();
              onClick?.();
            }}
            onMouseEnter={() => {
              setHovered(true);
              onPointerOver?.();
            }}
            onMouseLeave={() => {
              setHovered(false);
              onPointerOut?.();
            }}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
          >
            <span aria-hidden="true">{badgeInfo.emoji}</span>
            {isLocked && (
              <small className="map-location-lock" aria-hidden="true">
                🔒
              </small>
            )}
            {showLabel && (
              <span className="map-location-name">
                {label}
                {isLocked ? " · Locked" : ""}
              </span>
            )}
          </button>
        </Html>
      </group>
    </group>
  );
};
