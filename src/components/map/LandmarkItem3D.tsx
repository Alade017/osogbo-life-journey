import type { FC } from "react";
import { MapPin3D } from "./MapPin3D";

export interface LandmarkPlaceData {
  id: string;
  label: string;
  category: string;
  grid: { x: number; z: number };
}

export interface LandmarkItem3DProps {
  place: LandmarkPlaceData;
  position: [number, number, number];
  isSelected?: boolean;
  isHovered?: boolean;
  onSelectLandmark: (id: string, worldPosition: [number, number, number]) => void;
  onPointerOver?: (id: string, label: string) => void;
  onPointerOut?: (id: string) => void;
}

/**
 * Individual Landmark Component.
 * Removes outer collective grouping wrappers; each landmark renders as its own
 * autonomous component managing its own 3D position, non-animated pin, label, and events.
 */
export const LandmarkItem3D: FC<LandmarkItem3DProps> = ({
  place,
  position,
  isSelected = false,
  isHovered = false,
  onSelectLandmark,
  onPointerOver,
  onPointerOut,
}) => {
  return (
    <MapPin3D
      position={position}
      label={place.label}
      category={place.category}
      isSelected={isSelected}
      isHovered={isHovered}
      onClick={() => onSelectLandmark(place.id, position)}
      onPointerOver={() => onPointerOver?.(place.id, place.label)}
      onPointerOut={() => onPointerOut?.(place.id)}
    />
  );
};
