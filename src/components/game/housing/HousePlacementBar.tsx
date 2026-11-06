import { RotateCw, Move, X, Check } from "lucide-react";

type Props = {
  itemName: string;
  occupied: boolean;
  disabled: boolean;
  onRotate: () => void;
  onCancel: () => void;
  onPlace: () => void;
};

/** Shown while an item is being moved: pick a grid cell, then Place it or Cancel. */
export function HousePlacementBar({
  itemName,
  occupied,
  disabled,
  onRotate,
  onCancel,
  onPlace,
}: Props) {
  return (
    <div className="house-placement-bar" role="toolbar" aria-label="Placing item">
      <div className="house-placement-copy">
        <strong>{itemName}</strong>
        <span>
          {occupied ? "That spot is taken. Pick another cell." : "Drag it or use ← → ↑ ↓ · R turns"}
        </span>
      </div>
      <div className="house-placement-actions">
        <button type="button" onClick={onRotate} disabled={disabled} aria-label="Turn 45 degrees">
          <RotateCw size={16} aria-hidden="true" />
          Turn
        </button>
        <button type="button" disabled aria-label="Move mode is active">
          <Move size={16} aria-hidden="true" />
          Move
        </button>
        <button type="button" onClick={onCancel} disabled={disabled}>
          <X size={16} aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onPlace}
          disabled={disabled || occupied}
          className="house-placement-place"
        >
          <Check size={16} aria-hidden="true" />
          Place
        </button>
      </div>
    </div>
  );
}
