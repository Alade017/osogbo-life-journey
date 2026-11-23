import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira } from "@/lib/game";
import {
  buyPropertyListing,
  cancelPropertyListing,
  fetchPropertyMarket,
  fetchPropertySaleQuotes,
  listPropertyForSale,
  propertyMarketErrorMessage,
  type PropertyMarketListing,
} from "@/lib/property-sale";

/** Homes other players have listed, plus the player's own homes that they can list. */
export function PropertyMarketPanel() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pricing, setPricing] = useState<string | null>(null);
  const [askingNaira, setAskingNaira] = useState("");

  const market = useQuery({ queryKey: ["property-market"], queryFn: fetchPropertyMarket });
  const quotes = useQuery({ queryKey: ["property-sale-quotes"], queryFn: fetchPropertySaleQuotes });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["property-market"] });
    void queryClient.invalidateQueries({ queryKey: ["property-sale-quotes"] });
    void queryClient.invalidateQueries({ queryKey: ["ownedHouses"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  const list = useMutation({
    mutationFn: ({ playerPropertyId, asking }: { playerPropertyId: string; asking: number }) =>
      listPropertyForSale(playerPropertyId, asking),
    onSuccess: () => {
      toast.success("Your home is listed for sale.");
      setPricing(null);
      refresh();
    },
    onError: (error) => toast.error(propertyMarketErrorMessage(error)),
  });

  const cancel = useMutation({
    mutationFn: (listingId: string) => cancelPropertyListing(listingId),
    onSuccess: () => {
      toast.success("Listing cancelled.");
      refresh();
    },
    onError: (error) => toast.error(propertyMarketErrorMessage(error)),
  });

  const buy = useMutation({
    mutationFn: (listing: PropertyMarketListing) => buyPropertyListing(listing.listingId),
    onSuccess: (result) => {
      toast.success(`${result.propertyName} is yours.`);
      setConfirming(null);
      refresh();
    },
    onError: (error) => toast.error(propertyMarketErrorMessage(error)),
  });

  const listings = market.data ?? [];
  const forSale = listings.filter((listing) => !listing.isMine);
  const mine = listings.filter((listing) => listing.isMine);
  const listable = (quotes.data ?? []).filter((quote) => quote.sellable && quote.kind === "home");
  const unlisted = listable.filter(
    (quote) => !mine.some((listing) => listing.playerPropertyId === quote.playerPropertyId),
  );

  return (
    <section className="property-sale-panel" aria-labelledby="property-market-heading">
      <h2 id="property-market-heading">Homes for sale</h2>

      {forSale.length > 0 && (
        <ul>
          {forSale.map((listing) => {
            const isConfirming = confirming === listing.listingId;
            return (
              <li key={listing.listingId}>
                <span>
                  {listing.propertyName} · from {listing.sellerName}
                </span>
                {isConfirming ? (
                  <span className="property-sale-confirm">
                    <button
                      type="button"
                      disabled={buy.isPending}
                      onClick={() => buy.mutate(listing)}
                    >
                      {buy.isPending
                        ? "Buying…"
                        : `Confirm for ${formatNaira(listing.askingMinor)}`}
                    </button>
                    <button
                      type="button"
                      disabled={buy.isPending}
                      onClick={() => setConfirming(null)}
                    >
                      Not now
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirming(listing.listingId)}>
                    Buy for {formatNaira(listing.askingMinor)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <>
          <h3>Your listings</h3>
          <ul>
            {mine.map((listing) => (
              <li key={listing.listingId}>
                <span>
                  {listing.propertyName} · asking {formatNaira(listing.askingMinor)}
                </span>
                <button
                  type="button"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(listing.listingId)}
                >
                  Cancel listing
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {unlisted.length > 0 && (
        <>
          <h3>List one of your homes</h3>
          <ul>
            {unlisted.map((quote) => {
              const isPricing = pricing === quote.playerPropertyId;
              return (
                <li key={quote.playerPropertyId}>
                  <span>{quote.propertyName}</span>
                  {isPricing ? (
                    <form
                      className="property-sale-confirm"
                      onSubmit={(event) => {
                        event.preventDefault();
                        list.mutate({
                          playerPropertyId: quote.playerPropertyId,
                          asking: Number(askingNaira),
                        });
                      }}
                    >
                      <label>
                        Asking price (₦)
                        <input
                          inputMode="numeric"
                          value={askingNaira}
                          onChange={(event) =>
                            setAskingNaira(event.target.value.replace(/[^0-9]/g, ""))
                          }
                        />
                      </label>
                      <button type="submit" disabled={list.isPending || !askingNaira}>
                        {list.isPending ? "Listing…" : "List home"}
                      </button>
                      <button type="button" onClick={() => setPricing(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPricing(quote.playerPropertyId);
                        setAskingNaira(String(quote.amountMinor));
                      }}
                    >
                      List for players
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {forSale.length === 0 && mine.length === 0 && unlisted.length === 0 && (
        <p className="property-sale-note">No homes are listed for sale right now.</p>
      )}
    </section>
  );
}
