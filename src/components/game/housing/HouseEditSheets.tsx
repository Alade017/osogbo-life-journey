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
  cash: number | null;
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
const itemName = (id: string) => id.replaceAll("-", " ");

function ItemImage({ id }: { id: string }) {
  if (id === "plant")
    return (
      <span className="house-shop-image" aria-hidden="true">
        🪴
      </span>
    );
  const imageId =
    id === "bed"
      ? "starter-bed"
      : id.startsWith("sofa")
        ? "starter-seat"
        : id === "light"
          ? "starter-light"
          : id;
  return (
    <img className="house-shop-image" src={`/assets/items/${imageId}.webp`} alt="" loading="lazy" />
  );
}

export function HouseEditSheets({
  open,
  offline,
  pending,
  cash,
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
  useEffect(() => setConfirmRemove(false), [selectedPlacement?.id, selectedSlot?.id]);
  if (!open) return null;

  const ownedIds = new Set(inventory.map((item) => item.item_id));
  const availableFurniture = catalog.filter(
    (item) =>
      item.category === "furniture" &&
      item.price_minor > 0 &&
      !ownedIds.has(item.id) &&
      (!selectedSlot || item.slot_type === selectedSlot.slot_type),
  );
  const ownedForSlot = selectedSlot
    ? inventory.filter(
        (item) => item.category === "furniture" && item.slot_type === selectedSlot.slot_type,
      )
    : [];
  const ownedOutfit = inventory.filter(
    (item) => item.category !== "furniture" && item.slot_type === equipmentSlot,
  );
  const availableOutfit = catalog.filter(
    (item) =>
      item.category !== "furniture" &&
      item.slot_type === equipmentSlot &&
      item.price_minor > 0 &&
      !ownedIds.has(item.id),
  );

  const shopRows = (items: CatalogItem[]) =>
    items.length ? (
      items.map((item) => {
        const cannotAfford = cash !== null && cash < item.price_minor;
        return (
          <div className="house-inventory-row house-shop-row" key={item.id}>
            {item.category === "furniture" ? (
              <ItemImage id={item.id} />
            ) : (
              <span className="house-shop-image" aria-hidden="true">
                👕
              </span>
            )}
            <span className="house-shop-description">
              <strong>{itemName(item.id)}</strong>
              <small>
                {formatNaira(item.price_minor)} · {item.slot_type}
              </small>
              {cannotAfford && <small>Insufficient funds</small>}
            </span>
            <button
              type="button"
              className="house-row-action"
              disabled={offline || pending || cannotAfford}
              onClick={() => onBuy(item.id)}
            >
              Buy
            </button>
          </div>
        );
      })
    ) : (
      <p className="house-empty-copy">No more items are available here.</p>
    );

  return (
    <section className="house-edit-sheet house-edit-panel" aria-label="Shop and arrange your home">
      <header className="house-sheet-header">
        <div>
          <p className="house-sheet-eyebrow">Your home</p>
          <h2>
            {selectedPlacement
              ? itemName(selectedPlacement.item_id)
              : selectedSlot
                ? `Choose ${selectedSlot.slot_type}`
                : "Shop and arrange your space"}
          </h2>
        </div>
        <button
          type="button"
          className="house-icon-button"
          onClick={onClose}
          aria-label="Finish arranging your home"
        >
          <X size={19} />
        </button>
      </header>
      {!selectedSlot && !selectedPlacement && (
        <div className="house-sheet-tabs" role="tablist" aria-label="Item category">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "room"}
            onClick={() => setTab("room")}
          >
            <Sofa size={16} /> Household items
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
      {selectedPlacement ? (
        <div className="house-sheet-content">
          <p className="text-sm text-muted-foreground">This item is placed in your room.</p>
          {confirmRemove ? (
            <>
              <p className="text-sm">Remove it from this slot? It will return to your inventory.</p>
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
          ) : (
            <button
              type="button"
              className="house-action-secondary"
              disabled={offline || pending}
              onClick={() => setConfirmRemove(true)}
            >
              Remove from room
            </button>
          )}
        </div>
      ) : selectedSlot || tab === "room" ? (
        <div className="house-sheet-content">
          {selectedSlot ? (
            <>
              <h3 className="house-list-title">Your items for this slot</h3>
              {ownedForSlot.length ? (
                ownedForSlot.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="house-inventory-row"
                    disabled={offline || pending}
                    onClick={() => onPlace(item.item_id, selectedSlot)}
                  >
                    <span>{itemName(item.item_id)}</span>
                    <span className="house-row-action">
                      Place <Check size={15} />
                    </span>
                  </button>
                ))
              ) : (
                <p className="house-empty-copy">
                  You do not own an item for this slot yet. Choose one below.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Buy a household item, then tap an open room slot to place it. Purchased items stay in
              your inventory.
            </p>
          )}
          <h3 className="house-list-title">Household item shop</h3>
          {shopRows(availableFurniture)}
          {!selectedSlot && (
            <p className="house-empty-copy">
              {inventory.filter((item) => item.category === "furniture").length} household items
              owned. Tap a room slot to place one.
            </p>
          )}
        </div>
      ) : (
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
                <strong>{outfit[slot] ? itemName(outfit[slot]) : "Empty"}</strong>
              </button>
            ))}
          </div>
          <h3 className="house-list-title">Owned {equipmentSlot} items</h3>
          {ownedOutfit.map((item) => (
            <div className="house-inventory-row" key={item.id}>
              <span>{itemName(item.item_id)}</span>
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
          {!!availableOutfit.length && (
            <>
              <h3 className="house-list-title">Available to buy</h3>
              {shopRows(availableOutfit)}
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
  );
}
