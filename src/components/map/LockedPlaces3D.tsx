import { useState, type FC } from "react";
import { Html } from "@react-three/drei";
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

/** A landmark that is not available to visit yet, shown as a locked pin. */
export type LockedSourcePlace = {
  id: string;
  label: string;
  category: string;
  grid: { x: number; z: number };
  availabilityReason?: string;
  description?: string;
  unlockRequirement?: string;
};

export interface LockedPlaces3DProps {
  /** Every landmark the player cannot visit yet. */
  places: readonly LockedSourcePlace[];
  cellSize: number;
  gridCols: number;
  gridRows: number;
  onSelectLocked?: (place: LockedPlace) => void;
}

/** Renders each locked landmark as a locked pin at its authored grid cell. */
export const LockedPlaces3D: FC<LockedPlaces3DProps> = ({
  places,
  cellSize,
  gridCols,
  gridRows,
  onSelectLocked,
}) => {
  const [activeModal, setActiveModal] = useState<LockedPlace | null>(null);
  const lockedSites: LockedPlace[] = places.map((place) => ({
    id: place.id,
    name: place.label,
    category: place.category,
    position: [
      (place.grid.x - (gridCols - 1) / 2) * cellSize,
      0.2,
      (place.grid.z - (gridRows - 1) / 2) * cellSize,
    ],
    reason: place.availabilityReason ?? "This map-only point is not a travel destination yet.",
    lore: place.description ?? "A point of interest in the Osogbo-inspired game world.",
    unlockRequirement: place.unlockRequirement ?? "A future map implementation phase.",
  }));

  return (
    <group>
      {lockedSites.map((site) => (
        <MapPin3D
          key={site.id}
          position={site.position}
          label={site.name}
          category={site.category}
          isLocked
          lockReason={site.reason}
          onClick={() => {
            setActiveModal(site);
            onSelectLocked?.(site);
          }}
        />
      ))}
      {activeModal && (
        <Html center position={activeModal.position} distanceFactor={14}>
          <section
            role="dialog"
            aria-label={activeModal.name}
            style={{
              width: 280,
              background: "rgba(15, 23, 42, 0.96)",
              color: "#f8fafc",
              border: "1px solid #d6a34a",
              borderRadius: 12,
              padding: 14,
              boxShadow: "0 16px 32px rgba(0,0,0,0.45)",
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong>{activeModal.name}</strong>
              <button type="button" onClick={() => setActiveModal(null)} aria-label="Close">
                ×
              </button>
            </header>
            <p style={{ fontSize: 12, lineHeight: 1.5 }}>{activeModal.lore}</p>
            <p style={{ fontSize: 11, color: "#fcd34d" }}>{activeModal.reason}</p>
            <p style={{ fontSize: 11, color: "#cbd5e1" }}>
              Availability: {activeModal.unlockRequirement}
            </p>
          </section>
        </Html>
      )}
    </group>
  );
};
