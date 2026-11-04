import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Backpack, GlassWater, Package, Shirt, Smartphone, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { EmptyState } from "@/components/game/ui";
import { CardListSkeleton } from "@/components/game/loading-skeletons";
import { Button } from "@/components/ui/button";
import {
  countInventoryUnits,
  filterInventory,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  normalizeInventoryCategory,
  type InventoryCategory,
} from "@/lib/inventory-service";
import { itemUseEffect } from "@/lib/item-service";
import { validatePlayerAction } from "@/lib/player-action-service";
import type { EquipmentSlot } from "@/lib/player-state";
import {
  announceEquipmentRefresh,
  EQUIPMENT_SLOTS,
  filterEquippableInventoryForSlot,
  normalizeEquippedItems,
} from "@/lib/equipment-service";
import { getItemArt } from "@/lib/item-art";
import type { Appearance } from "@/game/avatar-appearance";
import { CharacterPreview } from "@/components/3d/CharacterPreview";
import { ItemPreview3D, hasItemModel } from "@/components/3d/ItemPreview3D";
import { ItemThumbnailQueue } from "@/components/3d/ItemThumbnailQueue";
import { useItemThumbnail } from "@/components/3d/item-thumbnails";
import "@/components/game/profile-inventory.css";

export const Route = createFileRoute("/_authenticated/_game/inventory")({
  head: () => pageMeta("Wardrobe", "Items your character carries around Osogbo."),
  component: InventoryPage,
});

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  backpack: Backpack,
  shirt: Shirt,
  "glass-water": GlassWater,
};

function InventoryTileArt({ slug, Icon }: { slug: string | null | undefined; Icon: LucideIcon }) {
  const thumbnail = useItemThumbnail(slug);
  const artwork = thumbnail ?? getItemArt(slug);
  return artwork ? (
    <img src={artwork} alt="" loading="lazy" width={64} height={64} />
  ) : (
    <Icon size={26} />
  );
}

export function InventoryPage() {
  const { data: items, isLoading, isError, error, refetch, isRefetching } = useQuery(q.inventory());
  const { data: character } = useQuery(q.character());
  const {
    data: equipment,
    isLoading: equipmentLoading,
    isError: equipmentError,
    refetch: refetchEquipment,
    isRefetching: isRefetchingEquipment,
  } = useQuery(q.equipment());
  const [activeCategory, setActiveCategory] = useState<InventoryCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestedSlot, setRequestedSlot] = useState<EquipmentSlot | null>(null);
  const useItem = useGameAction(rpc.useInventoryItem, {
    onSuccess: () => toast.success("Item used. Your needs and game time were updated."),
  });
  const equipItem = useGameAction(
    ({ id, slot }: { id: string; slot: string }) => rpc.equipInventoryItem(id, slot),
    {
      onSuccess: () => {
        announceEquipmentRefresh();
        toast.success("Equipment updated.");
      },
    },
  );
  const unequipItem = useGameAction(rpc.unequipItem, {
    onSuccess: () => {
      announceEquipmentRefresh();
      toast.success("Item returned to your bag.");
    },
  });
  const discardItem = useGameAction(
    ({ id, quantity }: { id: string; quantity: number }) => rpc.discardInventoryItem(id, quantity),
    {
      onSuccess: () => toast.success("Item discarded."),
    },
  );

  if (isLoading) return <CardListSkeleton label="Loading wardrobe" cards={4} />;
  if (isError)
    return (
      <section className="pi-panel" role="alert">
        <h1 className="text-lg font-bold text-ink">Unable to load your wardrobe</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button
          className="mt-4"
          variant="outline"
          disabled={isRefetching}
          onClick={() => void refetch()}
        >
          {isRefetching ? "Trying again…" : "Try again"}
        </Button>
      </section>
    );

  const inventory = items ?? [];
  const visibleItems = filterInventory(inventory, activeCategory);
  const compatibleItems = requestedSlot
    ? filterEquippableInventoryForSlot(visibleItems, requestedSlot)
    : visibleItems;
  const selectedItem = items?.find((item) => item.id === selectedId);
  const itemActionsAvailable = typeof selectedItem?.item?.usable === "boolean";
  const selectedUse = selectedItem ? itemUseEffect(selectedItem.item) : null;
  const selectedSlot = selectedItem?.item?.equipment_slot as EquipmentSlot | null | undefined;
  const useError =
    selectedItem && character
      ? validatePlayerAction({
          action: "use",
          characterId: character.id,
          inventoryEntry: selectedItem,
        })
      : "Player data is not available.";
  const equipError =
    selectedItem && character && selectedSlot
      ? validatePlayerAction({
          action: "equip",
          characterId: character.id,
          inventoryEntry: selectedItem,
          slot: selectedSlot,
        })
      : "This item cannot be equipped.";
  const categoryFilters: (InventoryCategory | "all")[] = ["all", ...INVENTORY_CATEGORIES];
  const normalizedEquipment = normalizeEquippedItems(equipment);
  const wornNow = normalizedEquipment.map((entry) => ({ slot: entry.slot, item: entry.item }));
  // Trying an item on: the stage shows the selected item in its slot, so 3D models appear live.
  const previewEquipment =
    selectedSlot && selectedItem
      ? [
          ...wornNow.filter((entry) => entry.slot !== selectedSlot),
          { slot: selectedSlot, item: selectedItem.item },
        ]
      : wornNow;
  const canTryOn = !!selectedSlot && !equipError;

  return (
    <div className="pi-page pi-inventory">
      <ItemThumbnailQueue
        slugs={(items ?? []).map((entry) => entry.item?.slug ?? "").filter(Boolean)}
      />
      <header className="pi-masthead">
        <p className="pi-eyebrow">Your collection</p>
        <h1>Wardrobe</h1>
        <p className="pi-sub">
          {inventory.length} item types · {countInventoryUnits(inventory)} items in your bag
        </p>
      </header>

      <section className="pi-stage" aria-label="Your character">
        <CharacterPreview
          appearance={(character?.appearance ?? {}) as unknown as Appearance}
          gender={character?.gender ?? "nonbinary"}
          equipment={previewEquipment}
          label="Your character, dressed for the wardrobe"
        />
        <div className="pi-stage-foot">
          <div>
            <strong>{selectedItem?.item?.name ?? "Your look"}</strong>
            <span>
              {selectedItem && canTryOn
                ? "Previewing on your character"
                : "Choose an item to try it on"}
            </span>
          </div>
        </div>
      </section>

      {equipmentLoading ? (
        <p className="pi-note" role="status">
          Loading equipment…
        </p>
      ) : equipmentError ? (
        <div className="pi-slot-actions">
          <p className="pi-note">Equipment couldn't be loaded.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetchingEquipment}
            onClick={() => void refetchEquipment()}
          >
            {isRefetchingEquipment ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <ul className="pi-slots" aria-label="Equipment slots">
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipped = equipment?.find((entry) => entry.slot === slot);
            return (
              <li key={slot} className={`pi-slot ${requestedSlot === slot ? "is-selected" : ""}`}>
                <span className="pi-slot-name">{slot}</span>
                {equipped ? (
                  <strong className="pi-slot-item">{equipped.item?.name ?? "Equipped"}</strong>
                ) : (
                  <span className="pi-slot-empty">Nothing on</span>
                )}
                <div className="pi-slot-actions">
                  <button
                    type="button"
                    className="pi-chip-btn pi-chip-btn-primary"
                    aria-pressed={requestedSlot === slot}
                    onClick={() => {
                      setRequestedSlot(slot);
                      setActiveCategory("all");
                      setSelectedId(null);
                      window.requestAnimationFrame(() =>
                        document.getElementById("inventory-items")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                      );
                    }}
                  >
                    {equipped ? "Change" : "Choose"}
                  </button>
                  {equipped && (
                    <button
                      type="button"
                      className="pi-chip-btn"
                      disabled={unequipItem.isPending}
                      onClick={() => unequipItem.mutate(slot)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!items?.length ? (
        <EmptyState title="Empty backpack" body="You don't own any items yet." />
      ) : (
        <>
          <div className="pi-filters" role="group" aria-label="Filter bag by category">
            {categoryFilters.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category === "all" ? "All items" : INVENTORY_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          {requestedSlot && (
            <p className="pi-banner" role="status">
              Choose an item for the {requestedSlot} slot. Only owned, compatible equipment is
              shown.{" "}
              <button type="button" onClick={() => setRequestedSlot(null)}>
                Show all items
              </button>
            </p>
          )}
          {requestedSlot && compatibleItems.length === 0 && (
            <p className="pi-banner" role="status">
              You do not have any {requestedSlot} equipment in your bag yet. Visit the market to
              look for some.
            </p>
          )}

          <div className="pi-bag-layout">
            <div className="pi-bag" id="inventory-items">
              {compatibleItems.map((item) => {
                const Icon = ICONS[item.item?.icon ?? ""] ?? Package;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="pi-tile"
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="pi-tile-art" aria-hidden="true">
                      <InventoryTileArt slug={item.item?.slug} Icon={Icon} />
                    </span>
                    <strong>{item.item?.name}</strong>
                    <small>
                      {INVENTORY_CATEGORY_LABELS[normalizeInventoryCategory(item.item)]} · ×
                      {item.quantity}
                    </small>
                  </button>
                );
              })}
            </div>

            <aside className="pi-detail" aria-live="polite">
              {selectedItem ? (
                <>
                  {hasItemModel(selectedItem.item?.slug) && (
                    <ItemPreview3D
                      key={selectedItem.item?.slug}
                      slug={selectedItem.item?.slug ?? ""}
                      label={selectedItem.item?.name ?? "Item"}
                    />
                  )}
                  <p className="pi-eyebrow">Item details</p>
                  <h2>{selectedItem.item?.name}</h2>
                  <p className="pi-sub">{selectedItem.item?.description}</p>
                  <dl className="pi-detail-facts">
                    <div>
                      <dt>Category</dt>
                      <dd>
                        {INVENTORY_CATEGORY_LABELS[normalizeInventoryCategory(selectedItem.item)]}
                      </dd>
                    </div>
                    <div>
                      <dt>Quantity</dt>
                      <dd>×{selectedItem.quantity}</dd>
                    </div>
                  </dl>
                  {itemActionsAvailable ? (
                    <div className="pi-detail-actions">
                      {selectedUse && (
                        <Button
                          disabled={!!useError || useItem.isPending}
                          onClick={() => useItem.mutate(selectedItem.id)}
                        >
                          {useItem.isPending
                            ? "Using…"
                            : selectedUse.action === "eat"
                              ? "Eat"
                              : selectedUse.action === "drink"
                                ? "Drink"
                                : "Use"}
                        </Button>
                      )}
                      {selectedSlot && (
                        <Button
                          variant="secondary"
                          disabled={
                            !!equipError ||
                            equipItem.isPending ||
                            (!!requestedSlot && selectedSlot !== requestedSlot)
                          }
                          onClick={() =>
                            equipItem.mutate({ id: selectedItem.id, slot: selectedSlot })
                          }
                        >
                          {equipItem.isPending ? "Putting on…" : `Wear (${selectedSlot})`}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={discardItem.isPending}
                        onClick={() => {
                          if (window.confirm(`Discard one ${selectedItem.item?.name ?? "item"}?`))
                            discardItem.mutate({ id: selectedItem.id, quantity: 1 });
                        }}
                      >
                        Discard one
                      </Button>
                    </div>
                  ) : (
                    <p className="pi-note">Item actions aren't available right now.</p>
                  )}
                  {((useError && selectedUse) || (equipError && selectedSlot)) && (
                    <p className="pi-note" role="status">
                      {useError && selectedUse ? useError : equipError}
                    </p>
                  )}
                </>
              ) : (
                <p className="pi-note">Select an item to try it on and see its details.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
