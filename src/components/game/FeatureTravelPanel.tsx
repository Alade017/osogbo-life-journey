import { useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useMapTravelController } from "@/components/map/use-map-travel-controller";
import { neighborhoodTripEstimate } from "@/game/neighborhood-transit";
import { isPlayableDistrict } from "@/game/playable-district";
import { formatNaira, type Character, type Location } from "@/lib/game";
import { TRAVEL_MODE_DETAILS, type TravelMode } from "@/lib/transport-service";

const MODES: TravelMode[] = ["walking", "keke", "danfo", "okada"];

/**
 * Travel options shown from a district feature block. Destinations and confirmation reuse the
 * transit flow: the server prices, charges and moves the character.
 */
export function FeatureTravelPanel({
  featureLabel,
  currentLocationId,
  locations,
  character,
  cash,
  navigate,
  queryClient,
}: {
  featureLabel: string;
  currentLocationId: string | undefined;
  locations: Location[];
  character: Pick<Character, "id" | "user_id" | "inside_home_property_id"> | null | undefined;
  cash: number | undefined;
  navigate: Parameters<typeof useMapTravelController<Location>>[0]["navigate"];
  queryClient: QueryClient;
}) {
  const [mode, setMode] = useState<TravelMode>("keke");
  const transit = useMapTravelController<Location>({ character, queryClient, navigate });
  const destinations = locations.filter((loc) => isPlayableDistrict(loc.slug));
  const selected = transit.state.landmark;
  const estimate = selected ? neighborhoodTripEstimate(selected, currentLocationId, mode) : null;
  const locked = transit.busy || transit.arrivalConfirmed;

  return (
    <div className="mt-2 space-y-2">
      <p className="text-muted-foreground">Travel options from {featureLabel.toLowerCase()}.</p>
      <div role="group" aria-label="Transport mode" className="flex flex-wrap gap-1">
        {MODES.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={mode === option}
            disabled={locked}
            onClick={() => setMode(option)}
            className="rounded-md border border-edge px-2 py-1 text-xs font-semibold"
          >
            {TRAVEL_MODE_DETAILS[option].label}
          </button>
        ))}
      </div>
      <ul className="space-y-1">
        {destinations.map((loc) => {
          const quote = neighborhoodTripEstimate(loc, currentLocationId, mode);
          return (
            <li key={loc.id}>
              <button
                type="button"
                aria-pressed={selected?.id === loc.id}
                disabled={!quote || locked}
                onClick={() => transit.select(loc)}
                className="flex w-full items-center justify-between rounded-md border border-edge px-2 py-1 text-left disabled:opacity-50"
              >
                <strong>{loc.name}</strong>
                <span className="text-xs">
                  {quote ? `${formatNaira(quote.fare)} · ~${quote.minutes} min` : "Unavailable"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <div className="space-y-1" aria-live="polite">
          <p>
            {selected.name}
            {estimate
              ? ` · ${TRAVEL_MODE_DETAILS[mode].label} · ${formatNaira(estimate.fare)} estimated`
              : ` · ${TRAVEL_MODE_DETAILS[mode].label} is not available here`}
          </p>
          {transit.state.error && <p role="alert">{transit.state.error}</p>}
          {transit.arrivalConfirmed ? (
            <button
              type="button"
              className="font-semibold underline"
              disabled={transit.busy}
              onClick={() => void transit.retryArrival()}
            >
              Retry destination loading
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md border-2 border-edge px-3 py-1 font-bold disabled:opacity-50"
              disabled={
                !estimate ||
                cash === undefined ||
                cash < estimate.fare ||
                transit.busy ||
                !character
              }
              onClick={() => void transit.confirm(selected.id, mode)}
            >
              {transit.busy ? "Confirming trip…" : "Confirm trip"}
            </button>
          )}
          {estimate && cash !== undefined && cash < estimate.fare && (
            <p>Not enough cash. Choose a cheaper option or walk.</p>
          )}
        </div>
      )}
    </div>
  );
}
