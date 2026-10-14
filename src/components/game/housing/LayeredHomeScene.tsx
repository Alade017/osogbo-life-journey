import { useState } from "react";
import { Avatar } from "@/components/game/Avatar";
import { Button } from "@/components/ui/button";

type HomeItem = {
  id: string;
  item_id: string;
  slot_type: string;
  slot_id: string | null;
  x: number;
  y: number;
  z: number;
  placed: boolean;
  equipped: boolean;
};
type HomeSlot = { id: string; slot_type: string; x?: number; y?: number };
type Props = {
  house: { label: string; asset_key: string; slots: HomeSlot[] };
  items: HomeItem[];
  appearance: Record<string, unknown>;
  gender: string;
  equipment?: { slot: string }[];
  onAction: (
    action: "place" | "remove" | "equip" | "unequip",
    itemId: string,
    slot?: HomeSlot,
  ) => void;
};

const ITEM_ASSETS: Record<string, string> = {
  "starter-bed": "/assets/items/starter-bed.svg",
  "starter-light": "/assets/items/starter-light.svg",
  "starter-seat": "/assets/items/starter-seat.svg",
  bed: "/assets/items/starter-bed.svg",
  sofa: "/assets/items/starter-seat.svg",
  plant: "/assets/items/starter-light.svg",
  stove: "/assets/items/stove.svg",
  shower: "/assets/items/shower.svg",
  toilet: "/assets/items/toilet.svg",
  computer: "/assets/items/computer.svg",
  television: "/assets/items/television.svg",
};

/** Loads only the selected house background and the item sprites this player owns. */
export function LayeredHomeScene({
  house,
  items,
  appearance,
  gender,
  equipment = [],
  onAction,
}: Props) {
  const [decorate, setDecorate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [slotFor, setSlotFor] = useState<HomeSlot | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const safeAppearance = appearance && typeof appearance === "object" ? appearance : {};
  const selectedItem = items.find((item) => item.id === selected) ?? null;
  const movingItem = items.find((item) => item.id === movingItemId) ?? null;
  const unplaced = items.filter(
    (item) => (!item.placed || item.id === movingItemId) && !item.equipped,
  );
  return (
    <section className="game-panel overflow-hidden p-3" aria-label={`${house.label} interior`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Your {house.label.toLowerCase()}</h2>
        <Button
          size="sm"
          variant={decorate ? "default" : "outline"}
          aria-pressed={decorate}
          onClick={() => {
            setDecorate((value) => !value);
            setSelected(null);
            setSlotFor(null);
          }}
        >
          {decorate ? "Done" : "Decorate"}
        </Button>
      </div>
      <div className="relative mx-auto aspect-[12/7] w-full max-w-3xl overflow-hidden rounded-2xl border border-edge bg-background">
        <img
          src={`/assets/homes/${house.asset_key}.svg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {items
          .filter((item) => item.placed && !item.equipped)
          .map((item) => {
            const src = ITEM_ASSETS[item.item_id.replace(/-\d+$/, "")];
            if (!src) return null;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.item_id.replaceAll("-", " ")}${decorate ? ", edit item" : ""}`}
                onClick={() => decorate && setSelected(item.id)}
                className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl ${decorate ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ring)]" : "pointer-events-none"}`}
                style={{ left: `${item.x}%`, top: `${item.y}%`, zIndex: item.z + 2 }}
              >
                <img src={src} alt="" className="h-[160%] w-[160%] object-contain" />
              </button>
            );
          })}
        <div
          className="absolute left-1/2 top-[58%] z-20 -translate-x-1/2 -translate-y-1/2"
          aria-label="Your character"
        >
          <Avatar
            appearance={safeAppearance as never}
            gender={gender}
            size={82}
            equipment={equipment}
          />
        </div>
        {items
          .filter((item) => item.equipped)
          .map((item) => {
            const src = ITEM_ASSETS[item.item_id.replace(/-\d+$/, "")];
            if (!src) return null;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.item_id.replaceAll("-", " ")}, worn on your character`}
                onClick={() => decorate && setSelected(item.id)}
                className="absolute left-1/2 top-[42%] z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2"
              >
                <img src={src} alt="" className="h-full w-full object-contain" />
              </button>
            );
          })}
        {decorate &&
          house.slots.map((slot) => {
            const occupant = items.find((item) => item.placed && item.slot_id === slot.id);
            const compatible = unplaced.filter((item) => item.slot_type === slot.slot_type);
            if (occupant) return null;
            return (
              <button
                key={slot.id}
                type="button"
                aria-label={`Empty ${slot.slot_type} slot`}
                className="absolute z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-dashed border-primary/70 bg-card/50 text-xs font-bold text-primary focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                style={{ left: `${slot.x ?? 50}%`, top: `${slot.y ?? 50}%` }}
                onClick={() => setSlotFor(slot)}
              >
                {compatible.length ? "+" : "·"}
              </button>
            );
          })}
      </div>
      {decorate && selectedItem && (
        <div className="mt-3 rounded-xl border border-edge bg-background p-3">
          <p className="font-semibold">{selectedItem.item_id.replaceAll("-", " ")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelected(null);
                setMovingItemId(selectedItem.id);
                setSlotFor(
                  house.slots.find(
                    (slot) =>
                      slot.slot_type === selectedItem.slot_type && slot.id !== selectedItem.slot_id,
                  ) ?? null,
                );
              }}
            >
              Move
            </Button>
            {["body", "top", "bottom", "hat", "accessory"].includes(selectedItem.slot_type) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onAction(selectedItem.equipped ? "unequip" : "equip", selectedItem.item_id);
                  setSelected(null);
                }}
              >
                {selectedItem.equipped ? "Remove wear" : "Wear"}
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onAction("remove", selectedItem.item_id);
                setSelected(null);
              }}
            >
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
      {decorate && slotFor && (
        <div
          className="mt-3 rounded-xl border border-edge bg-background p-3"
          role="dialog"
          aria-label={`Choose ${slotFor.slot_type} item`}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">
              {unplaced.some((item) => item.slot_type === slotFor.slot_type)
                ? `Choose ${slotFor.slot_type}`
                : `Empty ${slotFor.slot_type} slot`}
            </p>
            <button
              className="rounded-lg px-3 py-2 text-sm underline"
              onClick={() => {
                setSlotFor(null);
                setMovingItemId(null);
              }}
            >
              Close
            </button>
          </div>
          {unplaced
            .filter((item) => item.slot_type === slotFor.slot_type)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className="mt-2 min-h-11 w-full rounded-lg bg-card px-3 text-left font-medium"
                onClick={() => {
                  onAction("place", item.item_id, slotFor);
                  setSlotFor(null);
                  setMovingItemId(null);
                }}
              >
                {item.item_id.replaceAll("-", " ")}
              </button>
            ))}
          {!unplaced.some((item) => item.slot_type === slotFor.slot_type) && (
            <p className="mt-2 text-sm text-muted-foreground">
              No items fit this slot yet. Visit the shop to get furniture.
            </p>
          )}
        </div>
      )}
      {items.length === 0 && (
        <p className="mt-3 rounded-xl bg-background p-4 text-sm text-muted-foreground">
          Your home is empty. Visit the shop to get furniture.
        </p>
      )}
    </section>
  );
}
