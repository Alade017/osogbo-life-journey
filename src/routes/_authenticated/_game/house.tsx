import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader } from "@/components/game/ui";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/house")({
  head: () =>
    pageMeta("House Interior", "Explore your home, move between rooms, and improve your space."),
  component: HousePage,
});

function HousePage() {
  const {
    data: listingsData,
    isLoading,
    isError: listingsError,
    isFetching: listingsFetching,
    refetch: retryListings,
  } = useQuery(q.propertyListings());
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: rentData } = useQuery(q.rentStatus());
  const acquire = useGameAction(rpc.acquireProperty, {
    onSuccess: () => toast.success("Property secured. Your wallet and housing record are updated."),
  });
  const listings = (Array.isArray(listingsData) ? listingsData : []) as PropertyListing[];
  const rentStatus = rentData as {
    next_due_at?: string | null;
    next_amount?: number | null;
    unpaid_total?: number;
    unpaid_periods?: number;
  } | null;

  return (
    <div className="space-y-6">
      <PageHeader title="Homes and property" />
      {rentStatus?.next_due_at && (
        <section className="game-panel p-4" aria-label="Rent obligations">
          <h2 className="font-display font-bold">Rent obligations · game values</h2>
          <p className="mt-1 text-sm">
            {formatNaira(rentStatus.next_amount)} due{" "}
            {new Date(rentStatus.next_due_at).toLocaleDateString("en-NG")}
          </p>
          {(rentStatus.unpaid_periods ?? 0) > 0 && (
            <p className="mt-1 text-sm text-clay">
              {rentStatus.unpaid_periods} unpaid period(s): {formatNaira(rentStatus.unpaid_total)}.
              No eviction penalty applies.
            </p>
          )}
        </section>
      )}
      {isLoading ? (
        <LoadingState />
      ) : listingsError ? (
        <section
          className="game-panel space-y-3 p-5"
          aria-label="Property listings error"
          role="alert"
        >
          <h2 className="font-display text-lg font-bold">Property listings are unavailable</h2>
          <p className="text-sm text-muted-foreground">
            We couldn’t load the current homes. Your saved home interior is still available below.
          </p>
          <button
            className="min-h-11 rounded-lg border-2 border-edge px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={listingsFetching}
            onClick={() => void retryListings()}
          >
            {listingsFetching ? "Trying again…" : "Retry loading homes"}
          </button>
        </section>
      ) : listings.length ? (
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Property listings">
          {listings.map((property) => {
            const canRent = property.rent_price !== null;
            const canBuy = property.purchase_price !== null;
            const active = property.is_current;
            return (
              <article className="game-panel space-y-3 p-4" key={property.id}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {property.property_type.replaceAll("_", " ")}
                  </p>
                  <h2 className="font-display text-lg font-bold">{property.name}</h2>
                  <p className="text-sm text-muted-foreground">{property.description}</p>
                </div>
                {canRent && (
                  <p>
                    Rent: {formatNaira(property.rent_price)} every {property.rent_period_days} days
                  </p>
                )}
                {canBuy && <p>Purchase: {formatNaira(property.purchase_price)}</p>}
                <div className="flex flex-wrap gap-2">
                  {active ? (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold">
                      Current {property.active_tenure === "rented" ? "rental" : "property"}
                    </span>
                  ) : (
                    <>
                      {canRent && (
                        <button
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                          disabled={
                            acquire.isPending ||
                            (character?.level ?? 0) < property.level_required ||
                            (wallet?.balance ?? 0) < property.rent_price!
                          }
                          onClick={() =>
                            acquire.mutate({ propertyId: property.id, tenure: "rented" })
                          }
                        >
                          Rent
                        </button>
                      )}
                      {canBuy && (
                        <button
                          className="rounded-lg border-2 border-edge px-3 py-2 text-sm font-bold disabled:opacity-50"
                          disabled={
                            acquire.isPending ||
                            (character?.level ?? 0) < property.level_required ||
                            (wallet?.balance ?? 0) < property.purchase_price!
                          }
                          onClick={() =>
                            acquire.mutate({ propertyId: property.id, tenure: "owned" })
                          }
                        >
                          Buy
                        </button>
                      )}
                    </>
                  )}
                </div>
                {(character?.level ?? 0) < property.level_required && (
                  <p className="text-xs text-muted-foreground">
                    Requires player level {property.level_required}.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState title="No listings available" body="Check back later for homes in the city." />
      )}
      <section className="game-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-lg font-bold">Your saved home interior</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Room layouts, furniture, and home activity progress are managed with your saved game.
          </p>
        </div>
        <Link
          to="/home"
          search={{ visit: undefined }}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Open home interior
        </Link>
      </section>
    </div>
  );
}

type PropertyListing = {
  id: string;
  name: string;
  description: string;
  property_type: string;
  purchase_price: number | null;
  rent_price: number | null;
  rent_period_days: number;
  level_required: number;
  active_tenure: string | null;
  is_current: boolean;
};
