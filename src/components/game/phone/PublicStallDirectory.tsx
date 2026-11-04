import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira, q } from "@/lib/game";
import { getPublicStalls, publicStallKey, type PublicStall } from "@/lib/public-stall-service";
import {
  getPublicStallStock,
  purchasePlayerStallItem,
  STALL_CATEGORY_OPTIONS,
  type PublicStallCategory,
} from "@/lib/market-stall-service";

export function PublicStallDirectory({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<PublicStallCategory | null>(null);
  const [stockStall, setStockStall] = useState<PublicStall | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const visibility = () => setVisible(document.visibilityState !== "hidden");
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const listing = useInfiniteQuery({
    queryKey: publicStallKey(accountId, category),
    queryFn: ({ pageParam }) => getPublicStalls(accountId, pageParam, category),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!accountId && online && visible,
    refetchInterval: online && visible ? 30_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const stock = useQuery({
    queryKey: ["publicStallStock", stockStall?.id],
    queryFn: () => getPublicStallStock(stockStall!.id),
    enabled: !!stockStall && online && visible,
    retry: false,
  });
  const purchase = useMutation({
    mutationFn: purchasePlayerStallItem,
    onSuccess: async (receipt) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["publicStallStock", stockStall?.id] }),
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.inventory().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success(
        `Bought ${receipt.itemName} x${receipt.quantity} for ${formatNaira(receipt.totalMinor)}.`,
      );
    },
    onError: (error: Error) => toast.error(error.message.replaceAll("_", " ")),
  });
  const rows = listing.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="space-y-3 p-3" aria-label="Player stall directory">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Player stalls</h3>
        <button
          type="button"
          className="text-xs underline"
          disabled={!online || listing.isFetching}
          onClick={() => void listing.refetch()}
        >
          Refresh stalls
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Browse open, rented stalls and buy available stock from other players.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter stalls by category">
        <button
          type="button"
          aria-pressed={category === null}
          className={
            category === null
              ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
              : "rounded-full border px-3 py-1 text-xs"
          }
          onClick={() => {
            setCategory(null);
            setStockStall(null);
          }}
        >
          All
        </button>
        {STALL_CATEGORY_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            aria-pressed={category === option.id}
            className={
              category === option.id
                ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                : "rounded-full border px-3 py-1 text-xs"
            }
            onClick={() => {
              setCategory(option.id);
              setStockStall(null);
            }}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={category === "general"}
          className={
            category === "general"
              ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
              : "rounded-full border px-3 py-1 text-xs"
          }
          onClick={() => {
            setCategory("general");
            setStockStall(null);
          }}
        >
          Other
        </button>
      </div>
      {!online && (
        <p role="status" className="text-xs">
          Offline. {rows.length ? "Showing cached listings." : "Connect to browse player stalls."}
        </p>
      )}
      {online && listing.isPending && <p role="status">Loading player stalls…</p>}
      {listing.dataUpdatedAt > 0 && (
        <p className="text-xs text-muted-foreground">
          Last fetched:{" "}
          {new Intl.DateTimeFormat("en-NG", {
            timeStyle: "short",
            timeZone: "Africa/Lagos",
          }).format(listing.dataUpdatedAt)}{" "}
          (Lagos)
        </p>
      )}
      {listing.isError && (
        <div role="alert">
          <p>{listing.error.message}</p>
          <button
            type="button"
            disabled={!online || listing.isFetching}
            onClick={() => void listing.refetch()}
          >
            Retry stalls
          </button>
        </div>
      )}
      {!listing.isPending && !listing.isError && rows.length === 0 && (
        <p role="status">No other player stalls are open right now.</p>
      )}
      <ul className="space-y-3" aria-label="Open player stalls">
        {rows.map((row) => (
          <li key={row.id} className="phone-card min-w-0 p-3" style={{ overflowWrap: "anywhere" }}>
            <h4 className="text-sm font-bold">{row.name}</h4>
            <p className="text-xs">Owner: {row.ownerName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.goods}</p>
            <button
              type="button"
              className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
              aria-expanded={stockStall?.id === row.id}
              onClick={() => setStockStall((current) => (current?.id === row.id ? null : row))}
            >
              {stockStall?.id === row.id ? "Hide stock" : "View stock"}
            </button>
            {stockStall?.id === row.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {stock.isPending && <p role="status">Loading stall stock…</p>}
                {stock.isError && (
                  <p role="alert">
                    Stock is unavailable.{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void stock.refetch()}
                    >
                      Try again
                    </button>
                  </p>
                )}
                {!stock.isPending && !stock.isError && stock.data?.length === 0 && (
                  <p role="status">This stall has no stock available right now.</p>
                )}
                {stock.data?.map((item) => {
                  const quantity = quantities[item.id] ?? 1;
                  return (
                    <div
                      className="flex min-w-0 flex-wrap items-center justify-between gap-2"
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <strong className="block text-xs">{item.name}</strong>
                        <span className="text-[11px] text-muted-foreground">
                          {formatNaira(item.priceMinor)} · {item.quantity} available
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`Quantity of ${item.name}`}
                          type="number"
                          min={1}
                          max={Math.min(20, item.quantity)}
                          value={quantity}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [item.id]: Math.max(
                                1,
                                Math.min(20, item.quantity, Number(event.target.value)),
                              ),
                            }))
                          }
                          className="w-14 rounded border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                          disabled={!online || purchase.isPending || quantity > item.quantity}
                          onClick={() =>
                            purchase.mutate({
                              stallItemId: item.id,
                              quantity,
                              requestId: crypto.randomUUID(),
                            })
                          }
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      {listing.hasNextPage && (
        <button
          type="button"
          disabled={!online || listing.isFetching}
          onClick={() => void listing.fetchNextPage()}
        >
          {listing.isFetchingNextPage ? "Loading more stalls…" : "Load more stalls"}
        </button>
      )}
    </section>
  );
}
