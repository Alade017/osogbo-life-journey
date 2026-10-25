import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BedDouble, House, KeyRound, MapPin } from "lucide-react";
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
          "id,slug,name,description,property_type,house_type_id,purchase_price,rent_price,image_url,level_required,metadata",
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
    onError: async (error: Error, listing) => {
      const refreshed = await ownedQuery.refetch();
      if (
        refreshed.data?.some(
          (row) => row.tenure === "owned" && row.game_properties?.id === listing.id,
        )
      ) {
        setPurchaseError("");
        await Promise.all([
          client.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
          client.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
          client.invalidateQueries({ queryKey: q.wallet().queryKey }),
        ]);
        toast.success("House purchased. It is now your Home.");
        return;
      }
      setPurchaseError(
        error.message === "ALREADY_OWNED"
          ? "You already own this home. Open My property to set it as Home."
          : /internal error/i.test(error.message)
            ? "The property service could not complete this purchase. Please try again."
            : error.message,
      );
      void listingsQuery.refetch();
    },
  });
  const available = (listingsQuery.data ?? []).filter((listing) => !ownedIds.has(listing.id));
  return (
    <main className="property-market-page">
      <header className="property-market-hero map-sheet">
        <div className="property-market-hero-copy">
          <p className="map-sheet-eyebrow">FIND HOMES</p>
          <h1>Find your place in Osogbo</h1>
          <p>
            Explore homes by district. Buy a house or choose a weekly rental with Virtual Naira.
          </p>
        </div>
        <div className="property-market-hero-actions">
          <div className="property-market-balance">
            <span>Available cash</span>
            <strong>{balance === null ? "Loading…" : formatNaira(balance)}</strong>
          </div>
          <nav aria-label="Housing navigation">
            <Link to="/property">My property</Link>
            <Link to="/rentals">Browse rentals</Link>
          </nav>
        </div>
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
                  const rentable =
                    listing.rent_price != null &&
                    listing.slug === `housing-${listing.house_type_id}`;
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
                      <div className="property-market-card-body">
                        <div className="property-market-card-top">
                          <span className="property-market-house-icon">
                            <House size={22} aria-hidden="true" />
                          </span>
                          <span className="property-market-card-district">
                            <MapPin size={14} aria-hidden="true" />
                            {district}
                          </span>
                        </div>
                        <h3>{listing.name}</h3>
                        <p>{listing.description}</p>
                        <div className="property-market-facts">
                          <span>{listing.property_type.replaceAll("_", " ")}</span>
                          <span>
                            <BedDouble size={15} aria-hidden="true" />
                            {listing.metadata?.bedrooms ?? "—"} bed
                          </span>
                        </div>
                        {(listing.metadata?.features?.length ?? 0) > 0 && (
                          <ul className="property-market-features">
                            {listing.metadata!.features!.map((feature) => (
                              <li key={feature}>{feature}</li>
                            ))}
                          </ul>
                        )}
                        <div className="property-market-price">
                          <span>Purchase price</span>
                          <strong>{formatNaira(price)}</strong>
                          {rentable && (
                            <small>
                              or rent from {formatNaira(Number(listing.rent_price))} / week
                            </small>
                          )}
                        </div>
                        {reason && (
                          <p className="property-market-reason" role="status">
                            {reason}
                          </p>
                        )}
                        <div className="property-market-card-actions">
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
                              : "Buy home"}
                          </button>
                          {rentable && (
                            <Link
                              className="property-market-rent-button"
                              to="/rentals"
                              hash={listing.id}
                            >
                              <KeyRound size={16} aria-hidden="true" /> Rent instead
                            </Link>
                          )}
                        </div>
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
