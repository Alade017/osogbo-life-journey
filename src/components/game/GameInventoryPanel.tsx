import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Backpack, Gift, Laptop, Package, Search, Shirt, Utensils, X } from "lucide-react";
import { toast } from "sonner";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { q, rpc, useGameAction, formatNaira } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/game/ui";
import { CardListSkeleton } from "@/components/game/loading-skeletons";
import { countInventoryUnits, normalizeInventoryCategory } from "@/lib/inventory-service";
import { itemUseEffect } from "@/lib/item-service";
import { validatePlayerAction } from "@/lib/player-action-service";
import { getItemArt } from "@/lib/item-art";
import { ItemPreview3D, hasItemModel } from "@/components/3d/ItemPreview3D";
import { ItemThumbnailQueue } from "@/components/3d/ItemThumbnailQueue";
import { useItemThumbnail } from "@/components/3d/item-thumbnails";
import "@/components/game/profile-inventory.css";

type InventoryGroup = "all" | "consumables" | "clothing" | "tools" | "keepsakes";
const GROUPS: { id: InventoryGroup; label: string; icon: typeof Package }[] = [
  { id: "all", label: "All", icon: Package },
  { id: "consumables", label: "Consumables", icon: Utensils },
  { id: "clothing", label: "Clothing & Style", icon: Shirt },
  { id: "tools", label: "Tools & Tech", icon: Laptop },
  { id: "keepsakes", label: "Keepsakes", icon: Gift },
];
function groupFor(item: Parameters<typeof normalizeInventoryCategory>[0]): InventoryGroup {
  const category = normalizeInventoryCategory(item);
  if (category === "food" || category === "drinks") return "consumables";
  if (category === "clothing") return "clothing";
  if (category === "tools" || category === "electronics") return "tools";
  return "keepsakes";
}
function InventoryArt({ slug }: { slug: string | null | undefined }) {
  const thumb = useItemThumbnail(slug);
  const src = thumb ?? getItemArt(slug);
  return src ? <img src={src} alt="" loading="lazy" /> : <Package size={32} aria-hidden="true" />;
}
export function GameInventoryPanel() {
  const inventoryQuery = useQuery(q.inventory());
  const walletQuery = useQuery(q.wallet());
  const characterQuery = useQuery(q.character());
  const [group, setGroup] = useState<InventoryGroup>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const useItem = useGameAction(rpc.useInventoryItem, { onSuccess: () => toast.success("Item used. Your needs and game time were updated.") });
  const discardItem = useGameAction(({ id, quantity }: { id: string; quantity: number }) => rpc.discardInventoryItem(id, quantity), {
    onSuccess: () => { toast.success("Item discarded."); setDiscardId(null); setSelectedId(null); },
  });
  if (inventoryQuery.isLoading) return <CardListSkeleton label="Loading inventory" cards={4} />;
  if (inventoryQuery.isError && !inventoryQuery.data) return <section className="pi-panel" role="alert"><h1>Unable to load your inventory</h1><p>{inventoryQuery.error?.message ?? "Please try again."}</p><Button variant="outline" onClick={() => void inventoryQuery.refetch()} disabled={inventoryQuery.isRefetching}>Try again</Button></section>;
  const inventory = inventoryQuery.data ?? [];
  const query = search.trim().toLocaleLowerCase();
  const filtered = inventory.filter((entry) => (group === "all" || groupFor(entry.item) === group) && (!query || [entry.item?.name, entry.item?.description, entry.item?.slug].some((value) => value?.toLocaleLowerCase().includes(query))));
  const selected = inventory.find((entry) => entry.id === selectedId);
  const selectedUse = selected ? itemUseEffect(selected.item) : null;
  const useError = selected && characterQuery.data ? validatePlayerAction({ action: "use", characterId: characterQuery.data.id, inventoryEntry: selected }) : "Player data is not available.";
  const discardError = selected && characterQuery.data ? validatePlayerAction({ action: "discard", characterId: characterQuery.data.id, inventoryEntry: selected, quantity: 1 }) : "Player data is not available.";
  const discardTarget = inventory.find((entry) => entry.id === discardId);
  const discardValidation = discardTarget && characterQuery.data ? validatePlayerAction({ action: "discard", characterId: characterQuery.data.id, inventoryEntry: discardTarget, quantity: 1 }) : "Player data is not available.";
  const pending = useItem.isPending || discardItem.isPending || inventoryQuery.isError || characterQuery.isLoading || characterQuery.isError;
  const groupLabel = selected ? (groupFor(selected.item) === "consumables" ? "Consumable" : groupFor(selected.item) === "clothing" ? "Clothing & style" : groupFor(selected.item) === "tools" ? "Tools & tech" : "Keepsake") : "";
  return (
    <div className="pi-page pi-inventory pi-inventory-collection">
      <ItemThumbnailQueue slugs={inventory.map((entry) => entry.item?.slug ?? "").filter(Boolean)} />
      <header className="pi-inventory-topbar">
        <div className="pi-inventory-topbrand"><span className="pi-inventory-mark"><Backpack size={22} /></span><div><p className="pi-eyebrow">Your belongings</p><h1>Inventory</h1></div></div>
        <div className="pi-inventory-metrics"><span className="pi-wallet-chip"><strong>{walletQuery.data ? formatNaira(walletQuery.data.balance) : "—"}</strong><small>Wallet</small></span><span className="pi-capacity-chip"><strong>{countInventoryUnits(inventory)}</strong><small>Items owned</small></span></div>
      </header>
      <div className="pi-inventory-toolbar">
        <nav className="pi-collection-tabs" aria-label="Inventory categories">{GROUPS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={group === id} onClick={() => { setGroup(id); setSelectedId(null); }}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}</nav>
        <label className="pi-inventory-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search inventory</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your items…" aria-label="Search inventory" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</label>
      </div>
      {inventoryQuery.isError && <p className="pi-banner" role="alert">Your inventory refresh failed. Actions are paused until the connection recovers.</p>}
      {!inventory.length ? <EmptyState title="Your inventory is empty" body="Items you collect or purchase will appear here." /> : (
        <div className="pi-collection-layout">
          <section className="pi-collection-results" aria-label="Owned items">
            <div className="pi-collection-count"><strong>{filtered.length}</strong> items found <span>{countInventoryUnits(inventory)} total owned</span></div>
            {filtered.length ? <div className="pi-collection-grid">{filtered.map((entry) => <button key={entry.id} type="button" className="pi-collection-card" aria-pressed={selectedId === entry.id} onClick={() => { setSelectedId(entry.id); if (window.matchMedia("(max-width: 760px)").matches) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); }}>
              <span className="pi-collection-quantity">×{entry.quantity}</span><span className="pi-collection-art"><InventoryArt slug={entry.item?.slug} /></span><strong>{entry.item?.name ?? "Unknown item"}</strong><small>{groupFor(entry.item) === "consumables" ? "Consumable" : groupFor(entry.item) === "clothing" ? "Clothing & style" : groupFor(entry.item) === "tools" ? "Tools & tech" : "Keepsake"}</small>
            </button>)}</div> : <p className="pi-bag-empty" role="status">No items match this category or search.</p>}
          </section>
          <aside ref={detailRef} className="pi-collection-detail" aria-label="Selected item details" aria-live="polite">
            {selected ? <>
              <div className="pi-collection-detail-art">{hasItemModel(selected.item?.slug) ? <ItemPreview3D key={selected.item?.slug} slug={selected.item?.slug ?? ""} label={selected.item?.name ?? "Item"} /> : <InventoryArt slug={selected.item?.slug} />}</div>
              <div className="pi-detail-heading"><p className="pi-eyebrow">Item details</p><button type="button" className="pi-detail-clear" onClick={() => setSelectedId(null)}>Clear selection</button></div>
              <h2>{selected.item?.name ?? "Unknown item"}</h2><p className="pi-sub">{selected.item?.description ?? "No description is available for this item."}</p>
              <div className="pi-collection-badges"><span>{groupLabel}</span><strong>×{selected.quantity} owned</strong></div>
              {selectedUse && <Button className="pi-action-primary" disabled={!!useError || pending} onClick={() => useItem.mutate(selected.id)}>{useItem.isPending ? "Using…" : selectedUse.action === "eat" ? "Eat" : selectedUse.action === "drink" ? "Drink" : "Use item"}</Button>}
              {groupFor(selected.item) === "clothing" && <a className="pi-action-profile-link" href="/profile">Change appearance in Profile</a>}
              {selected.item && <Button variant="outline" className="pi-action-destructive" disabled={!!discardError || pending} onClick={() => setDiscardId(selected.id)}>Discard one</Button>}
              {((!!useError && !!selectedUse) || !!discardError) && <p className="pi-action-guidance" role="status">{selectedUse && useError ? useError : discardError}</p>}
            </> : <div className="pi-collection-empty-detail"><Package size={38} /><strong>Select an item</strong><p>Choose an item from your collection to inspect its details and available actions.</p></div>}
          </aside>
        </div>
      )}
      <AlertDialog.Root open={discardId !== null} onOpenChange={(open) => { if (!open) setDiscardId(null); }}>
        <AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 bg-foreground/40" style={{ zIndex: "calc(var(--game-dialog-layer) + 1)" }} /><AlertDialog.Content className="fixed left-1/2 top-1/2 grid w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg" style={{ zIndex: "calc(var(--game-dialog-layer) + 2)" }}>
          <AlertDialog.Title className="text-lg font-bold">Discard item?</AlertDialog.Title><AlertDialog.Description className="text-sm text-muted-foreground">{discardTarget ? "Remove one " + (discardTarget.item?.name ?? "item") + " from your inventory? This cannot be undone." : "This item is no longer available."}</AlertDialog.Description>
          {discardValidation && <p className="text-sm text-destructive" role="alert">{discardValidation}</p>}
          <div className="flex justify-end gap-2"><AlertDialog.Cancel asChild><Button variant="outline">Cancel</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button variant="destructive" disabled={!!discardValidation || pending} onClick={(event) => { event.preventDefault(); if (discardId && !discardValidation) discardItem.mutate({ id: discardId, quantity: 1 }); }}>Discard one</Button></AlertDialog.Action></div>
        </AlertDialog.Content></AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
