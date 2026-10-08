import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/game";
import type { TravelState } from "@/lib/travel-state";
import type { DrivingRoute } from "@/lib/route-service";

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function TravelPanel({
  state,
  currentBalance,
  isPending,
  isRouteLoading,
  route,
  routeMessage,
  onSelect,
  onStart,
  onCancel,
  onReset,
}: {
  state: TravelState;
  currentBalance: number;
  isPending: boolean;
  isRouteLoading: boolean;
  route: DrivingRoute | null;
  routeMessage: string | null;
  onSelect: () => void;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  if (state.status === "arrived") {
    return (
      <div className="travel-state-message travel-state-arrived" role="status" aria-live="polite">
        <strong>Arrived in {state.destinationName}.</strong>
        <span>Estimated journey: {state.estimatedMinutes} minutes.</span>
        <Button type="button" variant="plain" onClick={onReset}>
          Plan another trip
        </Button>
      </div>
    );
  }

  if (state.status === "traveling" || isPending) {
    return (
      <div className="travel-state-message" role="status" aria-live="polite">
        <strong>Travelling to {state.destinationName}…</strong>
        <span>Your destination and fare are being confirmed.</span>
      </div>
    );
  }

  if (state.status === "selecting_destination") {
    const canAfford = currentBalance >= (state.fare ?? 0);
    return (
      <div className="travel-selection-panel">
        <div>
          <p className="travel-selection-eyebrow">Destination selected</p>
          <h2>{state.destinationName}</h2>
          <dl>
            <div>
              <dt>Travel fare</dt>
              <dd>{formatNaira(state.fare)}</dd>
            </div>
            <div>
              <dt>{route ? "Road-route estimate" : "Configured travel estimate"}</dt>
              <dd>
                {route
                  ? `${Math.max(1, Math.ceil(route.durationSeconds / 60))} minutes`
                  : `${state.estimatedMinutes} minutes`}
              </dd>
            </div>
            {route && (
              <div>
                <dt>Street distance</dt>
                <dd>{formatDistance(route.distanceMeters)}</dd>
              </div>
            )}
          </dl>
        </div>
        {routeMessage && (
          <p className="travel-route-message" role="status">
            {routeMessage}
          </p>
        )}
        {state.error && (
          <p className="travel-state-error" role="alert">
            {state.error}
          </p>
        )}
        {!canAfford && (
          <p className="travel-state-error" role="status">
            You need {formatNaira((state.fare ?? 0) - currentBalance)} more to travel.
          </p>
        )}
        <div className="travel-selection-controls">
          <Button
            type="button"
            onClick={onStart}
            disabled={!canAfford || isPending || isRouteLoading}
          >
            <Navigation />
            {isPending ? "Travelling…" : isRouteLoading ? "Calculating route…" : "Travel now"}
          </Button>
          <Button type="button" variant="plain" onClick={onCancel} disabled={isPending}>
            <X /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="travel-state-entry">
      {state.status === "cancelled" && (
        <p role="status">Travel selection cancelled. You can choose this destination again.</p>
      )}
      <Button type="button" onClick={onSelect}>
        <Navigation /> Choose this destination
      </Button>
    </div>
  );
}
