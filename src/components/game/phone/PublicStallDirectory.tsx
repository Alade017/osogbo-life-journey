import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getPublicStalls, publicStallKey } from "@/lib/public-stall-service";

export function PublicStallDirectory({ accountId }: { accountId: string }) {
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
    queryKey: publicStallKey(accountId),
    queryFn: ({ pageParam }) => getPublicStalls(accountId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!accountId && online && visible,
    refetchInterval: online && visible ? 30_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
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
        Browse saved stall signs from other players. Listings are read-only.
      </p>
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
