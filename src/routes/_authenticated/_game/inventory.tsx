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
const TONES = ["bg-sun", "bg-leaf", "bg-sky", "bg-clay"];

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
      toast.success("Item returned to your inventory.");
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
    <div>
      <PageHeader
        eyebrow="Your collection"
        title="Inventory"
        subtitle={`${inventory.length} item types · ${countInventoryUnits(inventory)} items ready to use`}
      />
      {!items?.length ? (
        <EmptyState title="Empty backpack" body="You don't own any items yet." />
      ) : (
        <>
          <div
            className="inventory-categories"
            role="group"
            aria-label="Filter inventory by category"
          >
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
            <p className="inventory-detail-note" role="status">
              Choose an item for the {requestedSlot} slot. Only owned, compatible equipment is
              shown.{" "}
              <button type="button" onClick={() => setRequestedSlot(null)}>
                Show all items
              </button>
            </p>
          )}
          {requestedSlot && compatibleItems.length === 0 && (
            <p className="inventory-detail-note" role="status">
              You do not have any {requestedSlot} equipment in your bag yet. Visit the market to
              look for some.
            </p>
          )}
          <div className="inventory-layout">
            <div className="inventory-grid" id="inventory-items">
              {compatibleItems.map((item, index) => {
                const Icon = ICONS[item.item?.icon ?? ""] ?? Package;
                const artwork = getItemArt(item.item?.slug);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`game-panel inventory-card pop-in ${selectedId === item.id ? "inventory-card-selected" : ""}`}
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <span
                      className={`inventory-item-icon inventory-item-art ${TONES[index % TONES.length]}`}
                      aria-hidden="true"
                    >
                      {artwork ? (
                        <img src={artwork} alt="" loading="lazy" width={72} height={72} />
                      ) : (
                        <Icon className="h-7 w-7" />
                      )}
                    </span>
                    <span className="inventory-item-copy">
                      <strong>{item.item?.name}</strong>
                      <small>
                        {INVENTORY_CATEGORY_LABELS[normalizeInventoryCategory(item.item)]}
                      </small>
                    </span>
                    <Chip>×{item.quantity}</Chip>
                  </button>
                );
              })}
            </div>
            <aside className="inventory-detail game-panel" aria-live="polite">
              {selectedItem ? (
                <>
                  <div className="inventory-detail-stage" aria-hidden="true">
                    {getItemArt(selectedItem.item?.slug) ? (
                      <img
                        src={getItemArt(selectedItem.item?.slug)!}
                        alt=""
                        width={164}
                        height={164}
                      />
                    ) : (
                      <Package size={62} />
                    )}
                  </div>
                  <p className="inventory-detail-label">Item details</p>
                  <h2>{selectedItem.item?.name}</h2>
                  <p className="inventory-detail-description">{selectedItem.item?.description}</p>
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
                    <div className="inventory-action-buttons">
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
                    <p className="inventory-detail-note">
                      Item actions aren't available right now.
                    </p>
                  )}
                  {((useError && selectedUse) || (equipError && selectedSlot)) && (
                    <p className="inventory-detail-note" role="status">
                      {useError && selectedUse ? useError : equipError}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select an item to see its details.</p>
              )}
            </aside>
          </div>
        </>
      )}
      <section className="inventory-equipped game-panel" aria-label="Equipped items">
        <div className="inventory-equipped-heading">
          <div>
            <p className="inventory-detail-label">Your look</p>
            <h2>Equipment</h2>
          </div>
          <div className="inventory-avatar-preview" aria-label="Current outfit preview">
            <Avatar
              appearance={(character?.appearance as object) ?? {}}
              gender={character?.gender ?? "nonbinary"}
              size={76}
              equipment={previewEquipment}
            />
          </div>
        </div>
        {equipmentLoading ? (
          <p className="inventory-detail-note" role="status">
            Loading equipment…
          </p>
        ) : equipmentError ? (
          <div className="inventory-equipped-row">
            <p className="inventory-detail-note">Equipment couldn't be loaded.</p>
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
          <div className="inventory-equipment-grid">
            {EQUIPMENT_SLOTS.map((slot) => {
              const equipped = equipment?.find((item) => item.slot === slot);
              const equippedArt = getItemArt(equipped?.item?.slug);
              return (
                <div
                  key={slot}
                  className={`inventory-equipment-slot ${equipped ? "is-equipped" : ""} ${requestedSlot === slot ? "is-selected" : ""}`}
                >
                  <span className="inventory-equipment-slot-name">{slot}</span>
                  {equipped && (
                    <Check className="inventory-equipped-check" size={15} aria-hidden="true" />
                  )}
                  <span className="inventory-equipped-art" aria-hidden="true">
                    {equippedArt ? (
                      <img src={equippedArt} alt="" loading="lazy" width={64} height={64} />
                    ) : (
                      <Shirt size={24} />
                    )}
                  </span>
                  <strong>{equipped?.item?.name ?? "Empty"}</strong>
                  <small>{equipped ? "Equipped now" : "Nothing equipped"}</small>
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
                    {equipped ? "Change item" : "Choose from bag"}
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
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
