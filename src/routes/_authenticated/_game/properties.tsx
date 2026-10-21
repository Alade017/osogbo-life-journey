import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";
import { DISTRICTS, loadOwnedHouses, type SaleListing } from "@/lib/property-assets";
import { pageMeta } from "@/lib/seo";
import "@/components/map/map-ui.css";
import "@/components/game/housing/property-market.css";

export const Route = createFileRoute("/_authenticated/_game/properties")({
  head: () => pageMeta("Find Homes", "Buy a home in the fictional districts of Osogbo Life."),
  component: PropertiesPage,
});

export function PropertiesPage() {
  const client = useQueryClient();
  const characterQuery = useQuery(q.character());
  const walletQuery = useQuery(q.wallet());
  const character = characterQuery.data;
  const wallet = walletQuery.data;
  const [purchaseError, setPurchaseError] = useState("");
  const listingsQuery = useQuery({
    queryKey: ["saleHomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_properties")
        .select(
          "id,name,description,property_type,house_type_id,purchase_price,image_url,level_required,metadata",
        )
        .eq("is_active", true)
        .not("purchase_price", "is", null)
        .not("house_type_id", "is", null)
        .order("purchase_price", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaleListing[];
    },
  });
  const ownedQuery = useQuery({
    queryKey: ["ownedHouses", character?.id],
    enabled: !!character?.id,
    queryFn: () => loadOwnedHouses(character!.id),
  });
  const ownedIds = useMemo(
    () =>
      new Set(
        (ownedQuery.data ?? [])
          .filter((row) => row.tenure === "owned")
          .map((row) => row.game_properties?.id),
      ),
    [ownedQuery.data],
  );
  const balance =
    walletQuery.isPending || walletQuery.isError ? null : Number(wallet?.balance ?? 0);
  const loadError =
    characterQuery.error ?? walletQuery.error ?? listingsQuery.error ?? ownedQuery.error;
  const buy = useMutation({
    mutationFn: async (listing: SaleListing) => {
      const { error } = await supabase.rpc("acquire_game_property", {
        p_property_id: listing.id,
        p_tenure: "owned",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setPurchaseError("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["saleHomes"] }),
        client.invalidateQueries({ queryKey: ["ownedHouses"] }),
        client.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
        client.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
        client.invalidateQueries({ queryKey: ["housingProperties"] }),
        client.invalidateQueries({ queryKey: ["housingEligibility"] }),
        client.invalidateQueries({ queryKey: ["housingMapProperties"] }),
        client.invalidateQueries({ queryKey: q.wallet().queryKey }),
        client.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success("House purchased. It is now your Home.");
    },
    onError: (error: Error) => {
      setPurchaseError(error.message);
      void ownedQuery.refetch();
      void listingsQuery.refetch();
    },
  });
  const available = (listingsQuery.data ?? []).filter((listing) => !ownedIds.has(listing.id));
  return (
    <main className="property-market-page">
      <header className="property-market-hero map-sheet">
        <p className="map-sheet-eyebrow">FIND HOMES</p>
        <h1>Homes for sale</h1>
        <p>Choose a house in one of the fictional game districts. Prices are in Virtual Naira.</p>
        <strong>Available cash: {balance === null ? "Loading…" : formatNaira(balance)}</strong>
        <nav aria-label="Housing navigation">
          <Link to="/property">My property</Link>
          <Link to="/rentals">Rent a home</Link>
        </nav>
      </header>
      {purchaseError && (
        <p className="map-action-error" role="alert">
          {purchaseError}
        </p>
      )}
      {loadError ? (
        <div className="property-market-message" role="alert">
          <p>{loadError.message}</p>
          <button
            className="map-primary-button"
            onClick={() => {
              void characterQuery.refetch();
              void walletQuery.refetch();
              void listingsQuery.refetch();
              if (character?.id) void ownedQuery.refetch();
            }}
          >
            Try again
          </button>
        </div>
      ) : characterQuery.isPending ||
        walletQuery.isPending ||
        listingsQuery.isPending ||
        (Boolean(character?.id) && ownedQuery.isPending) ? (
        <p className="property-market-message" role="status">
          Loading homes…
        </p>
      ) : available.length === 0 ? (
        <p className="property-market-message">No homes are available to buy right now.</p>
      ) : (
        DISTRICTS.map((district) => {
          const homes = available.filter((listing) => listing.metadata?.district === district);
          if (!homes.length) return null;
          return (
            <section key={district} className="property-market-district" aria-label={district}>
              <h2>{district}</h2>
              <div className="property-market-grid">
                {homes.map((listing) => {
                  const price = Number(listing.purchase_price ?? 0);
                  const reason = !character
                    ? "Create a character first."
                    : balance === null
                      ? "Loading your wallet…"
                      : balance < price
                        ? `Insufficient funds. Need ${formatNaira(price - balance)} more.`
                        : (character?.level ?? 0) < listing.level_required
                          ? `Requires level ${listing.level_required}.`
                          : "";
                  return (
                    <article className="property-market-card map-sheet" key={listing.id}>
                      {listing.image_url && (
                        <img src={listing.image_url} alt={listing.name} loading="lazy" />
                      )}
                      <div className="property-market-card-body">
                        <p className="map-sheet-eyebrow">{district}</p>
                        <h3>{listing.name}</h3>
                        <p>{listing.description}</p>
                        <dl>
                          <div>
                            <dt>Type</dt>
                            <dd>{listing.property_type.replaceAll("_", " ")}</dd>
                          </div>
                          <div>
                            <dt>Bedrooms</dt>
                            <dd>{listing.metadata?.bedrooms ?? "—"}</dd>
                          </div>
                        </dl>
                        <p className="property-market-features">
                          {(listing.metadata?.features ?? []).join(" · ")}
                        </p>
                        <strong>{formatNaira(price)}</strong>
                        {reason && (
                          <p className="property-market-reason" role="status">
                            {reason}
                          </p>
                        )}
                        <button
                          className="map-primary-button"
                          disabled={!!reason || buy.isPending}
                          onClick={() => {
                            setPurchaseError("");
                            buy.mutate(listing);
                          }}
                        >
                          {buy.isPending && buy.variables?.id === listing.id
                            ? "Purchasing…"
                            : "Purchase home"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
