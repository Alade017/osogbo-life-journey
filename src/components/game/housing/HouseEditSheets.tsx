import { homeFurnitureAction } from "@/lib/home-furniture-actions";
import { ACTION_CATALOG } from "@/lib/life-simulation";
import { useEffect, useState, type TouchEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Package, RotateCw, Shirt, X } from "lucide-react";
import { formatNaira } from "@/lib/game";
import type { HouseInventoryItem, HousePlacement, HouseSlot } from "./HouseRoomScene";
import { CatalogThumbnailQueue, requestCatalogThumb, useCatalogThumb } from "./CatalogThumbnail";
import { hasItemModel } from "@/components/3d/ItemPreview3D";

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
  slots: HouseSlot[];
  placements: HousePlacement[];
  selectedSlot: HouseSlot | null;
  selectedPlacement: HousePlacement | null;
  onClose: () => void;
  onPlace: (itemId: string, slot: HouseSlot) => void;
  onSelectSlot: (slot: HouseSlot) => void;
  onRemove: (placement: HousePlacement) => void;
  /** Starts placement mode for a placed item; the bar then handles Move, Turn, Cancel and Place. */
  onStartMove: (placement: HousePlacement) => void;
  onBuy: (itemId: string) => void;
  singleRoom: boolean;
  onRotate: (placement: HousePlacement, rotation: number) => void;
};

const itemName = (id: string) => id.replaceAll("-", " ");
const rooms = [
  { id: "bathroom", label: "Bathroom", slots: ["bathroom"] },
  { id: "sitting", label: "Sitting room", slots: ["seat", "device", "table", "decor", "plant"] },
  { id: "kitchen", label: "Kitchen", slots: ["kitchen"] },
  { id: "bedroom", label: "Bedroom", slots: ["bed", "storage", "light"] },
] as const;

function ItemImage({ item }: { item: CatalogItem }) {
  const key =
    item.category === "furniture"
      ? item.art_key
        ? `furniture:${item.art_key}`
        : null
      : hasItemModel(item.id)
        ? `item:${item.id}`
        : null;
  const thumb = useCatalogThumb(key);
  useEffect(() => {
    if (key) requestCatalogThumb(key);
  }, [key]);

  if (!thumb)
    return (
      <span className="house-shop-image" aria-hidden="true">
        {item.category === "furniture" ? <Package size={25} /> : <Shirt size={25} />}
      </span>
    );
  return <img className="house-shop-image" src={thumb} alt="" />;
}

export function HouseEditSheets({
  open,
  offline,
  pending,
  cash,
  inventory,
  catalog,
  slots,
  placements,
  selectedSlot,
  selectedPlacement,
  onClose,
  onPlace,
  onSelectSlot,
  onRemove,
  onStartMove,
  onBuy,
  singleRoom,
  onRotate,
}: Props) {
  const [roomIndex, setRoomIndex] = useState(0);
  const [filterText, setFilterText] = useState("");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => setConfirmRemove(false), [selectedPlacement?.id, selectedSlot?.id]);
  const [turnDraft, setTurnDraft] = useState<number | null>(null);
  useEffect(() => setTurnDraft(null), [selectedPlacement?.id, selectedPlacement?.rotation_deg]);
  if (!open) return null;
  const currentTurn = Math.round(selectedPlacement?.rotation_deg ?? 0);
  const commitTurn = () => {
    if (!selectedPlacement || turnDraft === null || pending) return;
    const next = Math.round(turnDraft);
    if (next !== currentTurn) onRotate(selectedPlacement, next);
  };

  const ownedIds = new Set(inventory.map((item) => item.item_id));
  const availableFurniture = catalog.filter(
    (item) =>
      item.category === "furniture" &&
      item.price_minor > 0 &&
      !ownedIds.has(item.id) &&
      slots.some((slot) => slot.slot_type === item.slot_type) &&
      (!selectedSlot || item.slot_type === selectedSlot.slot_type),
  );
  const matchesFilter = (item: { id: string; slot_type: string }) => {
    const query = filterText.trim().toLowerCase();
    return !query || `${itemName(item.id)} ${item.slot_type}`.toLowerCase().includes(query);
  };
  const roomItems = selectedSlot
    ? availableFurniture.filter(matchesFilter)
    : availableFurniture
        .filter((item) => (rooms[roomIndex]?.slots as readonly string[]).includes(item.slot_type))
        .filter(matchesFilter);
  const ownedRoomItems = selectedSlot
    ? []
    : inventory
        .filter(
          (item) =>
            item.category === "furniture" &&
            (rooms[roomIndex]?.slots as readonly string[]).includes(item.slot_type),
        )
        .filter((item) => matchesFilter({ id: item.item_id, slot_type: item.slot_type }));
  const ownedForSlot = selectedSlot
    ? inventory
        .filter(
          (item) => item.category === "furniture" && item.slot_type === selectedSlot.slot_type,
        )
        .filter((item) => matchesFilter({ id: item.item_id, slot_type: item.slot_type }))
    : [];
  const shopRows = (items: CatalogItem[]) =>
    items.length ? (
      <div className="house-catalog-grid">
        {items.map((item) => {
          const activity = homeFurnitureAction(item.id);
          const cannotAfford = cash !== null && cash < item.price_minor;
          return (
            <article className="house-catalog-card" key={item.id}>
              <ItemImage item={item} />
              <span className="house-shop-description">
                <strong>{itemName(item.id)}</strong>
                <small>{item.slot_type}</small>
                {activity && (
                  <small className="house-item-task">{ACTION_CATALOG[activity].name}</small>
                )}
                <small className="house-catalog-price">{formatNaira(item.price_minor)}</small>
                {cannotAfford && (
                  <small className="house-catalog-unaffordable">Insufficient funds</small>
                )}
              </span>
              <button
                type="button"
                className="house-catalog-action"
                disabled={offline || pending || cannotAfford}
                onClick={() => onBuy(item.id)}
              >
                Buy
              </button>
            </article>
          );
        })}
      </div>
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
      <CatalogThumbnailQueue />
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
      {offline && (
        <p className="house-offline-note" role="status">
          Offline. Reconnect to save changes.
        </p>
      )}
      {selectedPlacement ? (
        <div className="house-sheet-content">
          <p className="text-sm text-muted-foreground">This item is placed in your room.</p>
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
      ) : (
        <div className="house-sheet-content">
          {selectedSlot ? (
            <>
              <h3 className="house-list-title">Your items for this slot</h3>
              {ownedForSlot.length ? (
                <div className="house-catalog-grid">
                  {ownedForSlot.map((item) => (
                    <article className="house-catalog-card" key={item.id}>
                      <ItemImage item={{ ...item, id: item.item_id }} />
                      <span className="house-shop-description">
                        <strong>{itemName(item.item_id)}</strong>
                        <small className="house-owned-badge">Owned · ready to place</small>
                      </span>
                      <button
                        type="button"
                        className="house-catalog-action"
                        disabled={offline || pending}
                        aria-label={`Place ${itemName(item.item_id)}`}
                        onClick={() => onPlace(item.item_id, selectedSlot)}
                      >
                        Place <Check size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="house-empty-copy">
                  You do not own an item for this slot yet. Choose one below.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose a slot, then drag furniture anywhere in the room.
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
              <label className="house-catalog-search">
                <span>Filter household items</span>
                <input
                  type="search"
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder="Search furniture"
                />
              </label>
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
              <article className="house-catalog-card" key={item.id}>
                <ItemImage item={{ ...item, id: item.item_id }} />
                <span className="house-shop-description">
                  <strong>{itemName(item.item_id)}</strong>
                  <small>
                    {item.slot_type} ·{" "}
                    {placements.filter((placement) => placement.item_id === item.item_id).length}{" "}
                    placed
                  </small>
                  <small className="house-owned-badge">Owned</small>
                </span>
                {slots.some(
                  (slot) =>
                    slot.slot_type === item.slot_type &&
                    !placements.some((placement) => placement.slot === slot.id),
                ) && (
                  <button
                    type="button"
                    className="house-catalog-action"
                    disabled={offline || pending}
                    onClick={() => {
                      const freeSlot = slots.find(
                        (slot) =>
                          slot.slot_type === item.slot_type &&
                          !placements.some((placement) => placement.slot === slot.id),
                      );
                      if (freeSlot) onSelectSlot(freeSlot);
                    }}
                  >
                    Choose slot
                  </button>
                )}
              </article>
            ))}
            {(roomItems.length > 0 || ownedRoomItems.length === 0) && shopRows(roomItems)}
          </div>
          {!selectedSlot && (
            <p className="house-empty-copy">
              {inventory.filter((item) => item.category === "furniture").length} household items
              owned. Place one, then drag it anywhere.
            </p>
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
