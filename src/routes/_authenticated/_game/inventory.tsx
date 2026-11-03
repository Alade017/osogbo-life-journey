import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Backpack,
  Check,
  GlassWater,
  Package,
  Shirt,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Chip, EmptyState, PageHeader } from "@/components/game/ui";
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
import { Avatar } from "@/components/game/Avatar";
import "@/components/game/profile-inventory.css";

export const Route = createFileRoute("/_authenticated/_game/inventory")({
  head: () => pageMeta("Inventory", "Items your character carries around Osogbo."),
  component: InventoryPage,
});

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  backpack: Backpack,
  shirt: Shirt,
  "glass-water": GlassWater,
};

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

  if (isLoading) return <CardListSkeleton label="Loading inventory" cards={4} />;
  if (isError)
    return (
      <section className="game-panel p-5" role="alert">
        <h1 className="text-lg font-bold text-ink">Unable to load inventory</h1>
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
  const previewEquipment = selectedSlot
    ? [...normalizedEquipment.filter((item) => item.slot !== selectedSlot), { slot: selectedSlot }]
    : normalizedEquipment;

  return (
    <div className="pi-page pi-inventory">
      <PageHeader
        eyebrow="Your collection"
        title="Inventory"
        subtitle={`${inventory.length} item types · ${countInventoryUnits(inventory)} items in your bag`}
      />

      <section className="pi-look game-panel" aria-label="Your look">
        <div className="pi-look-avatar">
          <Avatar
            appearance={(character?.appearance as object) ?? {}}
            gender={character?.gender ?? "nonbinary"}
            size={104}
            equipment={previewEquipment}
          />
        </div>
        <div>
          <p className="pi-kicker">Your look</p>
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
            <ul className="pi-slot-grid">
              {EQUIPMENT_SLOTS.map((slot) => {
                const equipped = equipment?.find((item) => item.slot === slot);
                const equippedArt = getItemArt(equipped?.item?.slug);
                return (
                  <li
                    key={slot}
                    className={`pi-slot ${equipped ? "is-equipped" : ""} ${requestedSlot === slot ? "is-selected" : ""}`}
                  >
                    <span className="pi-slot-name">{slot}</span>
                    <strong>{equipped?.item?.name ?? "Empty"}</strong>
                    {equippedArt ? (
                      <img src={equippedArt} alt="" loading="lazy" width={40} height={40} />
                    ) : equipped ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Shirt size={16} aria-hidden="true" />
                    )}
                    <div className="pi-slot-actions">
                      <Button
                        size="sm"
                        variant="outline"
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
                      </Button>
                      {equipped && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unequipItem.isPending}
                          onClick={() => unequipItem.mutate(slot)}
                        >
                          Unequip
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {!items?.length ? (
        <EmptyState title="Empty backpack" body="You don't own any items yet." />
      ) : (
        <>
          <div className="pi-filters" role="group" aria-label="Filter inventory by category">
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

          <div className="pi-layout">
            <div className="pi-grid" id="inventory-items">
              {compatibleItems.map((item) => {
                const Icon = ICONS[item.item?.icon ?? ""] ?? Package;
                const artwork = getItemArt(item.item?.slug);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="game-panel pi-card"
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="pi-card-art" aria-hidden="true">
                      {artwork ? (
                        <img src={artwork} alt="" loading="lazy" width={72} height={72} />
                      ) : (
                        <Icon className="h-7 w-7" />
                      )}
                    </span>
                    <strong>{item.item?.name}</strong>
                    <small>{INVENTORY_CATEGORY_LABELS[normalizeInventoryCategory(item.item)]}</small>
                    <Chip>×{item.quantity}</Chip>
                  </button>
                );
              })}
            </div>

            <aside className="pi-detail game-panel" aria-live="polite">
              {selectedItem ? (
                <>
                  <div className="pi-detail-stage" aria-hidden="true">
                    {getItemArt(selectedItem.item?.slug) ? (
                      <img src={getItemArt(selectedItem.item?.slug)!} alt="" />
                    ) : (
                      <Package size={62} />
                    )}
                  </div>
                  <p className="pi-kicker">Item details</p>
                  <h2>{selectedItem.item?.name}</h2>
                  <p className="pi-note">{selectedItem.item?.description}</p>
                  <dl>
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
                          {equipItem.isPending ? "Equipping…" : `Equip (${selectedSlot})`}
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
                <p className="pi-note">Select an item to see its details.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
