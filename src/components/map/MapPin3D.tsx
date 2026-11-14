import { useRef, type FC } from "react";
import type { Group } from "three";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";
import { placeBadgeFor } from "./map-badge";

export interface MapPin3DProps {
  position: [number, number, number];
  label: string;
  category: string;
  isLocked?: boolean;
  lockReason?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

/**
 * 3D Landmark & POI Pin with high-visibility native emoji rendering.
 * Purely static and non-animated for maximum legibility and stability.
 */
export const MapPin3D: FC<MapPin3DProps> = ({
  position,
  label,
  category,
  isLocked = false,
  lockReason,
  isSelected = false,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const pinGroupRef = useRef<Group>(null);
  const badgeInfo = placeBadgeFor(category);

  const displayEmoji = isLocked ? "🔒" : badgeInfo.emoji;
  const pinColor = isLocked ? "#d97706" : badgeInfo.tone;

  return (
    <group
      ref={pinGroupRef}
      position={[position[0], position[1] + 1.1, position[2]]}
      {...(onClick ? { onClick } : {})}
    >
      {/* 3D Pointer Stem Anchored Down to the Building (Static) */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.015, 0.8, 8]} />
        <meshStandardMaterial color={pinColor} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* 3D Emissive Base Ring (Static) */}
      <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.28, 16]} />
        <meshBasicMaterial color={pinColor} transparent opacity={0.65} />
      </mesh>

      {/* HTML Projected Pin: Non-animated, high-contrast, perfectly stable */}
      <Html
        center
        distanceFactor={18}
        zIndexRange={[100, 0]}
        style={{ pointerEvents: "auto", userSelect: "none" }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`${label}${isLocked ? " (Locked)" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          onPointerEnter={() => onPointerOver?.()}
          onPointerLeave={() => onPointerOut?.()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            transform: "none",
            transition: "none",
            animation: "none",
            filter: isSelected
              ? `drop-shadow(0 0 14px ${pinColor}) drop-shadow(0 4px 10px rgba(0,0,0,0.8))`
              : isHovered
                ? `drop-shadow(0 0 8px ${pinColor}99) drop-shadow(0 3px 6px rgba(0,0,0,0.6))`
                : "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
          }}
        >
          {/* Circular Emoji Badge Head */}
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 30%, ${pinColor}ff, ${pinColor}dd 60%, #0b1120 100%)`,
              border: `2.5px solid ${isSelected ? "#ffffff" : isLocked ? "#fef08a" : "#ffffffdd"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 14px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.4)`,
              position: "relative",
              transition: "none",
              animation: "none",
            }}
          >
            {/* Native Full-Color Emoji */}
            <span
              style={{
                fontSize: "24px",
                lineHeight: 1,
                filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
                transition: "none",
                animation: "none",
              }}
            >
              {displayEmoji}
            </span>

            {/* Locked mini badge indicator */}
            {isLocked && (
              <span
                style={{
                  position: "absolute",
                  bottom: "-2px",
                  right: "-2px",
                  background: "#b91c1c",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "1px 4px",
                  borderRadius: "8px",
                  border: "1px solid #ffffff",
                }}
              >
                LOCK
              </span>
            )}
          </div>

          {/* High-Contrast Floating Pill Label (Static) */}
          <div
            style={{
              marginTop: "5px",
              background: "rgba(11, 15, 23, 0.88)",
              backdropFilter: "blur(4px)",
              color: "#f8fafc",
              border: `1px solid ${isSelected ? pinColor : "rgba(255,255,255,0.18)"}`,
              borderRadius: "12px",
              padding: "2px 8px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.2px",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "none",
              animation: "none",
            }}
          >
            <span>{label}</span>
            {isLocked && lockReason && (
              <span style={{ color: "#f59e0b", fontSize: "10px" }}>🔒</span>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
};
