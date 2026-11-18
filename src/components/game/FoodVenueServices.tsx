import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { q, rpc, useGameAction } from "@/lib/game";
import { itemUseEffect } from "@/lib/item-service";
import { validatePlayerAction } from "@/lib/player-action-service";
import { isDiningItem } from "@/lib/food-venue";
import { MarketPage } from "@/routes/_authenticated/_game/market";

function FoodBag() {
  const actor = useQuery(q.character());
  const inventory = useQuery(q.inventory());
  const eat = useGameAction(rpc.useInventoryItem, {
    onSuccess: () => toast.success("Item used. Your saved needs have been refreshed."),
  });
  const entries = (inventory.data ?? []).filter(entry => isDiningItem(entry.item ?? null) && entry.quantity > 0);
  return <section className="space-y-2" aria-label="Eat or drink from your bag">
    <h3 className="font-semibold">Eat or drink from your bag</h3>
    <p className="text-sm text-muted-foreground">Purchasing adds items to your bag. Eating or drinking applies the configured item effect through the game server.</p>
    {inventory.isLoading && <p role="status">Loading your food…</p>}
    {(inventory.isError || actor.isError) && <div role="alert">
      <p>Your bag could not be loaded.</p>
      <button type="button" onClick={() => { void inventory.refetch(); void actor.refetch(); }}>Retry bag</button>
    </div>}
    {!inventory.isLoading && !inventory.isError && !entries.length && <p className="text-sm">You have no food or drinks in your bag.</p>}
    <ul className="space-y-2">
      {entries.map(entry => {
        const effect = itemUseEffect(entry.item ?? null);
        const error = actor.data ? validatePlayerAction({ action: "use", characterId: actor.data.id, inventoryEntry: entry }) : "Player details are loading.";
        return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge p-3">
          <span>{entry.item?.name} · {entry.quantity} in bag</span>
          <button type="button" className="rounded-lg border border-edge bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-50"
            disabled={!!error || !effect || eat.isPending} title={error ?? undefined}
            onClick={() => { if (!error && effect) eat.mutate(entry.id); }}>
            {effect?.action === "drink" ? "Drink" : "Eat"}
          </button>
        </li>;
      })}
    </ul>
  </section>;
}

export function FoodVenueServices({ shopSlug }: { shopSlug?: string | null }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-lg border border-edge p-3 text-sm font-semibold">Browse food & eat</summary>
    {open && <div className="mt-3 space-y-5">
      {shopSlug === undefined && <p className="text-sm text-muted-foreground">Showing food offers from open shops at your current location.</p>}
      <MarketPage foodOnly {...(shopSlug != null ? { shopSlug } : {})} />
      <FoodBag />
    </div>}
  </details>;
}
