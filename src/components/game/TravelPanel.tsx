import { useEffect, useState } from "react";
import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/game";
import type { TravelState } from "@/lib/travel-state";
import type { DrivingRoute } from "@/lib/route-service";
import {
  TRAVEL_MODE_DETAILS,
  travelAnimationDurationMs,
  type TravelMode,
} from "@/lib/transport-service";

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function TravelPanel({
  state,
  currentBalance,
  originName,
  isPending,
  isRouteLoading,
  route,
  routeMessage,
  onSelect,
  availableModes,
  onModeChange,
  onStart,
  onCancel,
  onReset,
}: {
  state: TravelState;
  currentBalance: number;
  originName: string;
  isPending: boolean;
  isRouteLoading: boolean;
  route: DrivingRoute | null;
  routeMessage: string | null;
  onSelect: () => void;
  availableModes: readonly TravelMode[];
  onModeChange: (mode: TravelMode) => void;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (state.status !== "traveling") {
      setProgress(state.status === "arrived" ? 100 : 0);
      return;
    }
    const startedAt = Date.now();
    const duration = travelAnimationDurationMs(state.estimatedMinutes ?? 1);
    const timer = window.setInterval(() => {
      setProgress(Math.min(95, Math.round(((Date.now() - startedAt) / duration) * 95)));
    }, 50);
    return () => window.clearInterval(timer);
  }, [state.status, state.estimatedMinutes]);

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
        <span>
          {TRAVEL_MODE_DETAILS[state.mode].label} journey · {state.estimatedMinutes} game minutes
        </span>
        <div
          className="travel-progress-track"
          role="progressbar"
          aria-label={`Journey to ${state.destinationName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  if (state.status === "selecting_destination") {
    const canAfford = currentBalance >= (state.fare ?? 0);
    return (
      <div className="travel-selection-panel">
        <div>
          <p className="travel-selection-eyebrow">Destination selected</p>
          <p className="travel-route-endpoints">
            {originName} <span>→</span> {state.destinationName}
          </p>
          <h2>{state.destinationName}</h2>
          <fieldset className="travel-mode-picker">
            <legend>Choose how to travel</legend>
            <div>
              {availableModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={state.mode === mode}
                  onClick={() => onModeChange(mode)}
                >
                  <strong>{TRAVEL_MODE_DETAILS[mode].label}</strong>
                  <small>{TRAVEL_MODE_DETAILS[mode].hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <dl>
            <div>
              <dt>{TRAVEL_MODE_DETAILS[state.mode].label} fare · game estimate</dt>
              <dd>{formatNaira(state.fare)}</dd>
            </div>
            <div>
              <dt>Trip duration · game estimate</dt>
              <dd>{state.estimatedMinutes} minutes</dd>
            </div>
            {route && (
              <div>
                <dt>Car-road distance</dt>
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
        <p className="travel-route-message">
          Transit stops and transfers are not mapped yet; non-car modes use game travel estimates.
        </p>
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
