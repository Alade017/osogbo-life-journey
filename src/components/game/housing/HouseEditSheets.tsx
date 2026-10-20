import { useEffect, useState, type TouchEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Shirt, Sofa, X } from "lucide-react";
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
const rooms = [
  { id: "bathroom", label: "Bathroom", slots: ["bathroom"] },
  { id: "sitting", label: "Sitting room", slots: ["seat", "device", "table", "decor", "plant"] },
  { id: "kitchen", label: "Kitchen", slots: ["kitchen"] },
  { id: "bedroom", label: "Bedroom", slots: ["bed", "storage", "light"] },
] as const;

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
  const [roomIndex, setRoomIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
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
  const roomItems = selectedSlot
    ? availableFurniture
    : availableFurniture.filter((item) =>
        (rooms[roomIndex]?.slots as readonly string[]).includes(item.slot_type),
      );
  const ownedRoomItems = selectedSlot
    ? []
    : inventory.filter(
        (item) =>
          item.category === "furniture" &&
          (rooms[roomIndex]?.slots as readonly string[]).includes(item.slot_type),
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
    <section
      className="house-edit-sheet house-edit-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Shop and arrange your home"
    >
      <span className="house-sheet-handle" aria-hidden="true" />
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
          {!selectedSlot && (
            <div className="house-room-carousel" aria-label="Household rooms">
              <div className="house-room-tabs" role="tablist" aria-label="Choose a room">
                {rooms.map((room, index) => (
                  <button
                    key={room.id}
                    type="button"
                    role="tab"
                    aria-selected={roomIndex === index}
                    onClick={() => setRoomIndex(index)}
                  >
                    {room.label}
                  </button>
                ))}
              </div>
              <div className="house-carousel-controls">
                <button
                  type="button"
                  aria-label="Previous room"
                  disabled={roomIndex === 0}
                  onClick={() => setRoomIndex((index) => Math.max(0, index - 1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <h3 className="house-list-title">{rooms[roomIndex]?.label} accessories</h3>
                <button
                  type="button"
                  aria-label="Next room"
                  disabled={roomIndex === rooms.length - 1}
                  onClick={() => setRoomIndex((index) => Math.min(rooms.length - 1, index + 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
          {selectedSlot && <h3 className="house-list-title">Items for this slot</h3>}
          <div
            className="house-room-slide"
            role="tabpanel"
            aria-label={
              selectedSlot
                ? `${selectedSlot.slot_type} items`
                : `${rooms[roomIndex]?.label} accessories`
            }
            onTouchStart={(event: TouchEvent<HTMLDivElement>) =>
              setTouchStart(event.touches[0]?.clientX ?? null)
            }
            onTouchEnd={(event: TouchEvent<HTMLDivElement>) => {
              const end = event.changedTouches[0]?.clientX;
              if (
                touchStart !== null &&
                end !== undefined &&
                Math.abs(end - touchStart) > 55 &&
                !selectedSlot
              )
                setRoomIndex((index) =>
                  Math.max(0, Math.min(rooms.length - 1, index + (end < touchStart ? 1 : -1))),
                );
              setTouchStart(null);
            }}
          >
            {ownedRoomItems.map((item) => (
              <div className="house-inventory-row house-shop-row" key={item.id}>
                <ItemImage id={item.item_id} />
                <span className="house-shop-description">
                  <strong>{itemName(item.item_id)}</strong>
                  <small>{item.slot_type} accessory</small>
                </span>
                <span className="house-owned-badge">Owned</span>
              </div>
            ))}
            {(roomItems.length > 0 || ownedRoomItems.length === 0) && shopRows(roomItems)}
          </div>
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
