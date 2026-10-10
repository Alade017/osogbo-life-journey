import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader } from "@/components/game/ui";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { purchaseTotal, shopIsOpen } from "@/lib/economy-service";
import { pageMeta } from "@/lib/seo";
import { useWorldClock } from "@/hooks/use-world-clock";

export const Route = createFileRoute("/_authenticated/_game/market")({
  head: () => pageMeta("Market", "Buy and sell goods at Osogbo shops."),
  component: MarketPage,
});

function MarketPage() {
  const { data: worldTime } = useWorldClock();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: locations } = useQuery(q.locations());
  const { data: shopItems, isLoading: shopsLoading } = useQuery(q.shopItems());
  const { data: inventory } = useQuery(q.inventory());
  const currentLocation = locations?.find(
    (location) => location.id === character?.current_location_id,
  );
  const itemsHere = useMemo(
    () =>
      shopItems?.filter(
        (offer) =>
          !!currentLocation &&
          !!offer.shop &&
          offer.shop.location_id === currentLocation.id &&
          shopIsOpen(
            offer.shop.is_open,
            offer.shop.opening_hour,
            offer.shop.closing_hour,
            worldTime?.hour ?? -1,
          ),
      ) ?? [],
    [shopItems, currentLocation, worldTime?.hour],
  );
  const purchase = useGameAction(rpc.purchaseShopItem, {
    onSuccess: () => toast.success("Purchase complete. Your inventory has been updated."),
  });
  const sell = useGameAction(rpc.sellInventoryItem, {
    onSuccess: () => toast.success("Item sold. The cash has been added to your wallet."),
  });

  if (characterLoading || shopsLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader title="City market" />
      <section className="game-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold">{currentLocation?.name ?? "No district selected"}</p>
          <p className="text-sm text-muted-foreground">
            Cash available: {formatNaira(wallet?.balance)}
          </p>
        </div>
        {!currentLocation && (
          <Link className="text-sm font-semibold text-primary underline" to="/map">
            Choose a district
          </Link>
        )}
      </section>

      {itemsHere.length ? (
        <section aria-labelledby="market-items-heading">
          <h2 id="market-items-heading" className="mb-3 text-2xl font-bold">
            Shop offers
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {itemsHere.map((offer) => {
              const item = offer.item;
              const unitPrice = offer.buy_price ?? item?.buy_price ?? 0;
              const quantity = quantities[offer.id] ?? 1;
              const quote = purchaseTotal(unitPrice, quantity, wallet?.balance ?? 0);
              const canBuy =
                item &&
                unitPrice > 0 &&
                (offer.stock === null || offer.stock >= quantity) &&
                (item.stackable ? quantity <= item.max_stack : quantity === 1);
              return (
                <li key={offer.id} className="game-panel flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl border-2 border-edge bg-sun p-3">
                      <ShoppingBag className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold">
                        {item?.name ?? "Shop item"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{item?.description}</p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatNaira(unitPrice)} each</p>
                  <label className="text-sm" htmlFor={`quantity-${offer.id}`}>
                    Quantity
                  </label>
                  <input
                    id={`quantity-${offer.id}`}
                    className="w-full rounded-lg border-2 border-edge bg-background px-3 py-2"
                    type="number"
                    min={1}
                    max={item?.stackable ? item.max_stack : 1}
                    step={1}
                    value={quantity}
                    onChange={(event) =>
                      setQuantities((old) => ({ ...old, [offer.id]: Number(event.target.value) }))
                    }
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">
                      Total: <strong>{formatNaira(quote.total)}</strong>
                    </p>
                    <button
                      type="button"
                      className="rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50"
                      disabled={!canBuy || !!quote.error || purchase.isPending}
                      onClick={() =>
                        purchase.mutate({
                          shopItemId: offer.id,
                          quantity,
                          requestId: crypto.randomUUID(),
                        })
                      }
                    >
                      Buy
                    </button>
                  </div>
                  {offer.stock !== null && (
                    <p className="text-xs text-muted-foreground">{offer.stock} in stock</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <EmptyState
          title="No shops in this district"
          body="Travel to a market, supermarket, clothing shop, or electronics store to browse its offers."
        />
      )}

      {itemsHere.length > 0 && inventory?.length ? (
        <section aria-labelledby="sell-items-heading">
          <h2 id="sell-items-heading" className="mb-3 text-2xl font-bold">
            Sell from your bag
          </h2>
          <ul className="game-panel divide-y-2 divide-edge/10 p-0">
            {inventory
              .filter(
                (entry) =>
                  entry.item?.sellable &&
                  itemsHere.some((offer) => offer.item_id === entry.item_id),
              )
              .map((entry) => {
                const offer = itemsHere.find((candidate) => candidate.item_id === entry.item_id)!;
                const sellPrice = offer.sell_price ?? entry.item?.sell_price ?? 0;
                return (
                  <li key={entry.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{entry.item?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.quantity} owned · {formatNaira(sellPrice)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border-2 border-edge bg-leaf px-4 py-2 font-bold disabled:opacity-50"
                      disabled={sellPrice <= 0 || sell.isPending}
                      onClick={() =>
                        sell.mutate({ shopId: offer.shop_id, inventoryId: entry.id, quantity: 1 })
                      }
                    >
                      Sell one
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
