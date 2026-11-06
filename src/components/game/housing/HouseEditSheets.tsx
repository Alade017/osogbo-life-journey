import { useEffect, useState } from "react";
import { RotateCw, X } from "lucide-react";
import type { HousePlacement } from "./HouseRoomScene";

type Props = {
  offline: boolean;
  pending: boolean;
  selectedPlacement: HousePlacement | null;
  singleRoom: boolean;
  onDeselect: () => void;
  onRemove: (placement: HousePlacement) => void;
  /** Starts placement mode for a placed item; the bar then handles Turn, Move, Cancel and Place. */
  onStartMove: (placement: HousePlacement) => void;
  onRotate: (placement: HousePlacement, rotation: number) => void;
};

const itemName = (id: string) => id.replaceAll("-", " ");

/** The panel for a placed item: Move, Turn, and Store (remove from the room). */
export function HouseEditSheets({
  offline,
  pending,
  selectedPlacement,
  singleRoom,
  onDeselect,
  onRemove,
  onStartMove,
  onRotate,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => setConfirmRemove(false), [selectedPlacement?.id]);
  const [turnDraft, setTurnDraft] = useState<number | null>(null);
  useEffect(() => setTurnDraft(null), [selectedPlacement?.id, selectedPlacement?.rotation_deg]);

  if (!selectedPlacement) return null;
  const currentTurn = Math.round(selectedPlacement.rotation_deg ?? 0);
  const commitTurn = () => {
    if (turnDraft === null || pending) return;
    const next = Math.round(turnDraft);
    if (next !== currentTurn) onRotate(selectedPlacement, next);
  };

  return (
    <section className="house-edit-sheet house-edit-panel" role="dialog" aria-label="Item">
      <span className="house-sheet-handle" aria-hidden="true" />
      <header className="house-sheet-header">
        <div>
          <p className="house-sheet-eyebrow">Your home</p>
          <h2>{itemName(selectedPlacement.item_id)}</h2>
        </div>
        <button
          type="button"
          className="house-icon-button"
          onClick={onDeselect}
          aria-label="Close item"
        >
          <X size={19} />
        </button>
      </header>
      {offline && (
        <p className="house-offline-note" role="status">
          Offline. Reconnect to save changes.
        </p>
      )}
      <div className="house-sheet-content">
        <div className="house-move-options">
          <h3 className="house-list-title">Move</h3>
          <button
            type="button"
            className="house-inventory-row"
            disabled={offline || pending}
            onClick={() => onStartMove(selectedPlacement)}
          >
            <span>
              {singleRoom ? "Drag it or pick a new spot" : "Pick a new spot on the floor"}
            </span>
            <span className="house-row-action">Move</span>
          </button>
        </div>
        <div className="house-turn-control">
          <h3 className="house-list-title">Turn</h3>
          <div className="house-turn-row">
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              aria-label="Turn angle"
              aria-valuetext={`${turnDraft ?? currentTurn} degrees`}
              value={turnDraft ?? currentTurn}
              disabled={offline || pending}
              onChange={(event) => setTurnDraft(Number(event.target.value))}
              onPointerUp={commitTurn}
              onKeyUp={commitTurn}
              onBlur={commitTurn}
            />
            <output className="house-turn-angle">{turnDraft ?? currentTurn}°</output>
          </div>
          <button
            type="button"
            className="house-action-secondary"
            disabled={offline || pending}
            aria-label={`Turn ${itemName(selectedPlacement.item_id)} 45 degrees`}
            onClick={() => onRotate(selectedPlacement, (currentTurn + 45) % 360)}
          >
            <RotateCw size={16} aria-hidden="true" />
            Turn 45°
          </button>
        </div>
        {confirmRemove ? (
          <>
            <p className="text-sm">Store it? It will return to your inventory.</p>
            <div className="house-sheet-actions">
              <button
                type="button"
                className="house-action-secondary"
                onClick={() => setConfirmRemove(false)}
              >
                Keep item
              </button>
              <button
                type="button"
                className="house-action-primary"
                disabled={offline || pending}
                onClick={() => onRemove(selectedPlacement)}
              >
                Confirm
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="house-action-secondary"
            disabled={offline || pending}
            onClick={() => setConfirmRemove(true)}
          >
            Store
          </button>
        )}
      </div>
      {pending && (
        <p className="house-pending-note" role="status">
          Saving your changes…
        </p>
      )}
    </section>
  );
}
