import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchPropertySaleQuotes,
  propertySaleErrorMessage,
  sellPropertyToNpc,
  type PropertySaleQuote,
} from "@/lib/property-sale";
import { formatNaira } from "@/lib/game";
import "./property-sale.css";

/** Lists the player's homes and stalls that an NPC buyer will take, with a confirm step. */
export function PropertySalePanel() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const quotes = useQuery({
    queryKey: ["property-sale-quotes"],
    queryFn: fetchPropertySaleQuotes,
  });

  const sale = useMutation({
    mutationFn: (quote: PropertySaleQuote) => sellPropertyToNpc(quote.playerPropertyId),
    onSuccess: (result) => {
      toast.success(`${result.propertyName} sold for ${formatNaira(result.amountMinor)}.`);
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ["property-sale-quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["ownedHouses"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error) => toast.error(propertySaleErrorMessage(error)),
  });

  const sellable = (quotes.data ?? []).filter((quote) => quote.sellable);
  if (quotes.isPending || sellable.length === 0) return null;

  return (
    <section className="property-sale-panel" aria-labelledby="property-sale-heading">
      <h2 id="property-sale-heading">Sell to an NPC buyer</h2>
      <p className="property-sale-note">
        NPC buyers pay a share of the price you paid. A furnished home sells with its furniture.
      </p>
      <ul>
        {sellable.map((quote) => {
          const isConfirming = confirming === quote.playerPropertyId;
          return (
            <li key={quote.playerPropertyId}>
              <span>
                {quote.propertyName} · {quote.kind === "stall" ? "Market stall" : "Home"}
              </span>
              {isConfirming ? (
                <span className="property-sale-confirm">
                  <button
                    type="button"
                    disabled={sale.isPending}
                    onClick={() => sale.mutate(quote)}
                  >
                    {sale.isPending ? "Selling…" : `Confirm for ${formatNaira(quote.amountMinor)}`}
                  </button>
                  <button
                    type="button"
                    disabled={sale.isPending}
                    onClick={() => setConfirming(null)}
                  >
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(quote.playerPropertyId)}>
                  Sell for {formatNaira(quote.amountMinor)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
