import { useState, type FC } from "react";
import { Html } from "@react-three/drei";
import { WorldMaterial } from "@/components/3d/WorldScene";
import { MapPin3D } from "./MapPin3D";

export interface LockedPlace {
  id: string;
  name: string;
  category: string;
  position: [number, number, number];
  reason: string;
  lore: string;
  unlockRequirement: string;
}

export interface LockedPlaces3DProps {
  cellSize: number;
  gridCols: number;
  gridRows: number;
  onSelectLocked?: (place: LockedPlace) => boolean | void;
}

/**
 * 3D Locked & Restricted Heritage Places on the Osogbo map.
 * Adds landmark monuments for iconic locked cultural sites:
 * - Osun-Osogbo Sacred Grove (UNESCO sacred site & ancient shrine)
 * - Ataoja Palace Royal Inner Court (Monarch's ceremonial sanctum)
 * - Lantern Club VIP Sky Lounge (Exclusive rooftop terrace)
 */
export const LockedPlaces3D: FC<LockedPlaces3DProps> = ({
  cellSize,
  gridCols,
  gridRows,
  onSelectLocked,
}) => {
  const [activeModal, setActiveModal] = useState<LockedPlace | null>(null);

  const xMax = (gridCols / 2 - 2) * cellSize;
  const zMax = (gridRows / 2 - 2) * cellSize;

  const lockedSites: LockedPlace[] = [
    {
      id: "osun-sacred-grove",
      name: "Osun-Osogbo Sacred Grove",
      category: "worship",
      position: [xMax * 0.65, 0.2, zMax * 0.72],
      reason: "Sacred UNESCO World Heritage Site",
      lore: "A sacred forest sanctuary along the banks of the Osun river, housing shrines, sculptures, and ceremonial altars honoring Osun, the goddess of fertility.",
      unlockRequirement: "Cultural Heritage Permit / Annual Osun Festival Access",
    },
    {
      id: "ataoja-inner-palace",
      name: "Ataoja Palace Inner Court",
      category: "services",
      position: [-xMax * 0.18, 0.35, -zMax * 0.6],
      reason: "Royal Ceremonial Sanctum",
      lore: "The historic royal residence of the Ataoja of Osogboland. The inner court houses royal thrones, ancient drums, and traditional chiefs' council chambers.",
      unlockRequirement: "Royal Chieftaincy Audience / High Reputation",
    },
    {
      id: "lantern-vip-lounge",
      name: "Lantern VIP Sky Lounge",
      category: "food",
      position: [xMax * 0.55, 0.2, -zMax * 0.55],
      reason: "VIP Membership Required",
      lore: "An exclusive rooftop lounge overlooking the city lights of Osogbo, reserved for high-society banquets, private music releases, and distinguished guests.",
      unlockRequirement: "VIP Club Pass or ₦50,000 Net Worth",
    },
  ];

  return (
    <group>
      {lockedSites.map((site) => (
        <group key={site.id} position={site.position}>
          {/* 1. Specialized 3D Architectural Monument */}
          {site.id === "osun-sacred-grove" && (
            <group position={[0, 0, 0]}>
              {/* Sacred Altar Shrine Base */}
              <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[cellSize * 0.9, cellSize * 1.1, 0.36, 16]} />
                <WorldMaterial tone="wall" />
              </mesh>
              {/* Yoruba Carved Shrine Portal */}
              <mesh position={[0, 0.8, 0]} castShadow>
                <boxGeometry args={[cellSize * 0.8, cellSize * 0.9, 0.2]} />
                <WorldMaterial tone="clay" />
              </mesh>
              {/* Sacred Totem Stones */}
              {[-0.6, 0.6].map((tx) => (
                <mesh key={`totem-${tx}`} position={[tx, 0.65, 0.3]} castShadow>
                  <cylinderGeometry args={[0.08, 0.14, 0.9, 6]} />
                  <WorldMaterial tone="timber" />
                </mesh>
              ))}
              {/* Sacred Water Pool */}
              <mesh position={[0, 0.05, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[cellSize * 0.45, 16]} />
                <meshStandardMaterial color="#0d9488" roughness={0.1} />
              </mesh>
            </group>
          )}

          {site.id === "ataoja-inner-palace" && (
            <group position={[0, 0, 0]}>
              {/* Raised Palace Courtyard Foundation */}
              <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[cellSize * 1.6, 0.4, cellSize * 1.4]} />
                <WorldMaterial tone="concrete" />
              </mesh>
              {/* Steep Yoruba Palace Roof */}
              <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
                <coneGeometry args={[cellSize * 0.95, 1.4, 4]} />
                <WorldMaterial tone="roof" />
              </mesh>
              {/* Carved Royal Veranda Pillars */}
              {[-1, 1].map((px) =>
                [-1, 1].map((pz) => (
                  <mesh key={`p-${px}-${pz}`} position={[px * 0.7, 0.65, pz * 0.6]} castShadow>
                    <cylinderGeometry args={[0.07, 0.07, 0.9, 8]} />
                    <WorldMaterial tone="timber" />
                  </mesh>
                )),
              )}
            </group>
          )}

          {site.id === "lantern-vip-lounge" && (
            <group position={[0, 0, 0]}>
              {/* Modern Multi-tier Lounge Structure */}
              <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[cellSize * 1.3, 1.2, cellSize * 1.1]} />
                <WorldMaterial tone="slate" />
              </mesh>
              {/* Neon Rooftop Terrace Canopy */}
              <mesh position={[0, 1.3, 0]}>
                <boxGeometry args={[cellSize * 1.4, 0.1, cellSize * 1.2]} />
                <meshStandardMaterial color="#c026d3" metalness={0.6} roughness={0.2} />
              </mesh>
            </group>
          )}

          {/* 2. Floating 3D Lock Pin with native 🔒 emoji */}
          <MapPin3D
            position={[0, site.id === "ataoja-inner-palace" ? 1.8 : 1.3, 0]}
            label={site.name}
            category={site.category}
            isLocked={true}
            lockReason={site.reason}
            onClick={() => {
              const accepted = onSelectLocked?.(site);
              if (accepted !== false) setActiveModal(site);
            }}
          />
        </group>
      ))}

      {/* Interactive Locked Place Dialog Card */}
      {activeModal && (
        <Html center position={activeModal.position} distanceFactor={14}>
          <div
            style={{
              width: "290px",
              background: "rgba(15, 23, 42, 0.96)",
              backdropFilter: "blur(12px)",
              color: "#f8fafc",
              border: "2px solid #f59e0b",
              borderRadius: "14px",
              padding: "16px",
              boxShadow: "0 20px 35px rgba(0,0,0,0.85), 0 0 20px rgba(245, 158, 11, 0.25)",
              zIndex: 1000,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  background: "#b45309",
                  color: "#fef3c7",
                  fontSize: "11px",
                  fontWeight: "bold",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                🔒 RESTRICTED PLACE
              </span>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            </div>

            <h3 style={{ fontSize: "15px", fontWeight: "bold", margin: "10px 0 4px 0", color: "#ffffff" }}>
              {activeModal.name}
            </h3>
            <p style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.45, margin: "0 0 10px 0" }}>
              {activeModal.lore}
            </p>

            <div
              style={{
                background: "rgba(0,0,0,0.35)",
                padding: "8px 10px",
                borderRadius: "8px",
                fontSize: "11px",
                borderLeft: "3px solid #f59e0b",
              }}
            >
              <div style={{ color: "#fef08a", fontWeight: "bold" }}>Requirement to Access:</div>
              <div style={{ color: "#94a3b8", marginTop: "2px" }}>{activeModal.unlockRequirement}</div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
