import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HouseInterior } from "@/components/game/HouseInterior";
import { EmptyState, LoadingState, PageHeader } from "@/components/game/ui";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/house")({
  head: () =>
    pageMeta("House Interior", "Explore your home, move between rooms, and improve your space."),
  component: HousePage,
});

function HousePage() {
  const { data: listingsData, isLoading } = useQuery(q.propertyListings());
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const acquire = useGameAction(rpc.acquireProperty, {
    onSuccess: () => toast.success("Property secured. Your wallet and housing record are updated."),
  });
  const listings = (Array.isArray(listingsData) ? listingsData : []) as PropertyListing[];

  return (
    <div className="space-y-6">
      <PageHeader title="Homes and property" />
      {isLoading ? (
        <LoadingState />
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
      <HouseInterior />
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
