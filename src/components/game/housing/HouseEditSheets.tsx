import { useEffect, useState } from "react";
import { Check, Shirt, Sofa, X } from "lucide-react";
import { formatNaira } from "@/lib/game";
import type { HouseInventoryItem, HouseOutfit, HousePlacement, HouseSlot } from "./HouseRoomScene";

type CatalogItem = {
  id: string;
  category: string;
  slot_type: string;
  art_key: string;
  price_minor: number;
};
type Props = {
  open: boolean;
  offline: boolean;
  pending: boolean;
  inventory: HouseInventoryItem[];
  catalog: CatalogItem[];
  outfit: HouseOutfit;
  selectedSlot: HouseSlot | null;
  selectedPlacement: HousePlacement | null;
  onClose: () => void;
  onPlace: (itemId: string, slot: HouseSlot) => void;
  onRemove: (placement: HousePlacement) => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: keyof HouseOutfit) => void;
  onBuy: (itemId: string) => void;
};

const outfitSlots: Array<keyof HouseOutfit> = ["head", "top", "bottom", "shoes", "accessory"];

export function HouseEditSheets({
  open,
  offline,
  pending,
  inventory,
  catalog,
  outfit,
  selectedSlot,
  selectedPlacement,
  onClose,
  onPlace,
  onRemove,
  onEquip,
  onUnequip,
  onBuy,
}: Props) {
  const [tab, setTab] = useState<"room" | "avatar">("room");
  const [equipmentSlot, setEquipmentSlot] = useState<keyof HouseOutfit>("top");
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    setConfirmRemove(false);
  }, [selectedPlacement?.id, selectedSlot?.id]);
  if (!open) return null;
  const ownedForSlot = inventory.filter(
    (item) => item.category !== "furniture" && item.slot_type === equipmentSlot,
  );
  const ownedIds = new Set(inventory.map((item) => item.item_id));
  const lockedForSlot = catalog.filter(
    (item) =>
      item.category !== "furniture" && item.slot_type === equipmentSlot && !ownedIds.has(item.id),
  );
  const ownedForPlacement = selectedSlot
    ? inventory.filter(
        (item) => item.category === "furniture" && item.slot_type === selectedSlot.slot_type,
      )
    : [];

  return (
    <div
      className="house-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="house-edit-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Edit your home"
      >
        <div className="house-sheet-handle" aria-hidden="true" />
        <header className="house-sheet-header">
          <div>
            <p className="house-sheet-eyebrow">Your home</p>
            <h2>
              {selectedPlacement
                ? selectedPlacement.item_id.replaceAll("-", " ")
                : selectedSlot
                  ? `Choose ${selectedSlot.slot_type}`
                  : "Edit your space"}
            </h2>
          </div>
          <button
            type="button"
            className="house-icon-button"
            onClick={onClose}
            aria-label="Close edit sheet"
          >
            <X size={19} />
          </button>
        </header>
        {!selectedSlot && !selectedPlacement && (
          <div className="house-sheet-tabs" role="tablist" aria-label="Edit category">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "room"}
              onClick={() => setTab("room")}
            >
              <Sofa size={16} /> Room
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "avatar"}
              onClick={() => setTab("avatar")}
            >
              <Shirt size={16} /> Avatar
            </button>
          </div>
        )}
        {offline && (
          <p className="house-offline-note" role="status">
            Offline. Reconnect to save changes.
          </p>
        )}
        {selectedPlacement && (
          <div className="house-sheet-content">
            {!confirmRemove ? (
              <>
                <p className="text-sm text-muted-foreground">This item is placed in your room.</p>
                <button
                  type="button"
                  className="house-action-secondary"
                  disabled={offline || pending}
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove from room
                </button>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Remove this item from its slot? It will return to your inventory.
                </p>
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
                    Confirm removal
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {selectedSlot && (
          <div className="house-sheet-content">
            <p className="text-sm text-muted-foreground">
              Only items made for this slot can be placed here.
            </p>
            {ownedForPlacement.length ? (
              ownedForPlacement.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="house-inventory-row"
                  disabled={offline || pending}
                  onClick={() => onPlace(item.item_id, selectedSlot)}
                >
                  <span>{item.item_id.replaceAll("-", " ")}</span>
                  <span className="house-row-action">
                    Place <Check size={15} />
                  </span>
                </button>
              ))
            ) : (
              <p className="house-empty-copy">
                You don’t own furniture for this slot yet. Visit the shop to find some.
              </p>
            )}
          </div>
        )}
        {!selectedSlot && !selectedPlacement && tab === "room" && (
          <div className="house-sheet-content">
            <p className="text-sm text-muted-foreground">
              Tap an open slot in the room to place furniture you own.
            </p>
            <p className="house-empty-copy">
              {inventory.filter((item) => item.category === "furniture").length
                ? `${inventory.filter((item) => item.category === "furniture").length} furniture items in your inventory.`
                : "Your home is empty. Visit the shop to get furniture."}
            </p>
          </div>
        )}
        {!selectedSlot && !selectedPlacement && tab === "avatar" && (
          <div className="house-sheet-content">
            <div className="house-equipment-slots">
              {outfitSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="house-equipment-slot"
                  aria-pressed={equipmentSlot === slot}
                  onClick={() => setEquipmentSlot(slot)}
                >
                  <span>{slot}</span>
                  <strong>{outfit[slot] ? outfit[slot]!.replaceAll("-", " ") : "Empty"}</strong>
                </button>
              ))}
            </div>
            <h3 className="house-list-title">Owned {equipmentSlot} items</h3>
            {ownedForSlot.map((item) => (
              <div className="house-inventory-row" key={item.id}>
                <span>{item.item_id.replaceAll("-", " ")}</span>
                <button
                  type="button"
                  className="house-row-action"
                  disabled={offline || pending || outfit[equipmentSlot] === item.item_id}
                  onClick={() => onEquip(item.item_id)}
                >
                  {outfit[equipmentSlot] === item.item_id ? "Equipped" : "Equip"}
                </button>
              </div>
            ))}
            {outfit[equipmentSlot] && (
              <button
                type="button"
                className="house-action-secondary"
                disabled={offline || pending}
                onClick={() => onUnequip(equipmentSlot)}
              >
                Unequip {equipmentSlot}
              </button>
            )}
            {!!lockedForSlot.length && (
              <>
                <h3 className="house-list-title">Available to buy</h3>
                {lockedForSlot.map((item) => (
                  <div className="house-inventory-row" key={item.id}>
                    <span>
                      {item.id.replaceAll("-", " ")} <small>{formatNaira(item.price_minor)}</small>
                    </span>
                    <button
                      type="button"
                      className="house-row-action"
                      disabled={offline || pending}
                      onClick={() => onBuy(item.id)}
                    >
                      Buy
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {pending && (
          <p className="house-pending-note" role="status">
            Saving your changes…
          </p>
        )}
      </section>
    </div>
  );
}
