import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, MapPin, Navigation, Wallet, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { GameTime } from "@/lib/game-time";
import type { Location } from "@/lib/game";
import { formatMapNaira } from "@/components/map/map-ui-utils";
import { isPlayableDistrict } from "@/game/playable-district";
import { MapApiError, requestMapLandmark } from "@/lib/map-api";
import {
  estimateTrip,
  getAvailableTravelModes,
  TRAVEL_MODE_DETAILS,
  type TravelMode,
} from "@/lib/transport-service";
import { adjustedTripMinutes } from "@/lib/world-simulation";

type Destination = Pick<
  Location,
  "id" | "slug" | "name" | "travel_fare" | "travel_minutes" | "level_required" | "metadata"
>;

type Props = {
  open: boolean;
  landmark: { id: string; label: string };
  districtName: string;
  accountId?: string;
  characterId?: string;
  destination: Destination | null;
  isLoadingDestination: boolean;
  destinationLoadError: boolean;
  onRetryDestination: () => void;
  originName: string;
  currentLocationId: string | null;
  characterLevel: number | null;
  walletBalance: number | null;
  walletLoading: boolean;
  gameTime: GameTime;
  offline: boolean;
  pending: boolean;
  arrivalConfirmed: boolean;
  refreshingArrival: boolean;
  error: string | null;
  onConfirm: (mode: TravelMode) => void;
  onCancel: () => void;
  onOpenDetails: () => void;
  onRetryArrival: () => void;
};

export function MapTravelSelector({
  open,
  landmark,
  districtName,
  accountId,
  characterId,
  destination,
  isLoadingDestination,
  destinationLoadError,
  onRetryDestination,
  originName,
  currentLocationId,
  characterLevel,
  walletBalance,
  walletLoading,
  gameTime,
  offline,
  pending,
  arrivalConfirmed,
  refreshingArrival,
  error,
  onConfirm,
  onCancel,
  onOpenDetails,
  onRetryArrival,
}: Props) {
  const [selectedMode, setSelectedMode] = useState<TravelMode | null>(null);
  const destinationIsPlayable = !!destination && isPlayableDistrict(destination.slug);
  const modes = useMemo(
    () => (destination ? getAvailableTravelModes(destination.metadata) : []),
    [destination],
  );
  const detailsQuery = useQuery({
    queryKey: ["mapLandmarkDetails", landmark.id, accountId, characterId],
    queryFn: () => {
      if (!accountId) throw new Error("Player account is not ready.");
      return requestMapLandmark(landmark.id, accountId);
    },
    enabled: open && !!accountId && !!characterId && !offline && destinationIsPlayable,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
  const restricted =
    detailsQuery.error instanceof MapApiError && detailsQuery.error.code === "AGE_RESTRICTED";
  const modeIsAvailable = !!selectedMode && modes.includes(selectedMode);
  const estimate =
    destination && modeIsAvailable && selectedMode
      ? estimateTrip(selectedMode, destination.travel_fare, destination.travel_minutes)
      : null;
  const estimatedMinutes =
    estimate && selectedMode ? adjustedTripMinutes(estimate.minutes, selectedMode, gameTime) : null;
  const cannotAfford = estimate !== null && walletBalance !== null && walletBalance < estimate.fare;
  const alreadyHere = !!destination && currentLocationId === destination.id;
  const levelLocked =
    !!destination && characterLevel !== null && characterLevel < destination.level_required;
  const accessCheckPending =
    destinationIsPlayable && !offline && (detailsQuery.isPending || !accountId || !characterId);
  const accessCheckFailed =
    destinationIsPlayable && !offline && detailsQuery.isError && !restricted;
  const canTravel =
    open &&
    !!destination &&
    destinationIsPlayable &&
    !offline &&
    !pending &&
    !arrivalConfirmed &&
    !accessCheckPending &&
    !accessCheckFailed &&
    !restricted &&
    !alreadyHere &&
    !levelLocked &&
    modeIsAvailable &&
    !cannotAfford;

  useEffect(() => {
    if (!open || pending || arrivalConfirmed) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [arrivalConfirmed, onCancel, open, pending]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="map-travel-overlay">
      <section
        className="map-travel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-travel-title"
      >
        <header className="map-travel-header">
          <div>
            <p className="map-sheet-eyebrow">Choose your transport</p>
            <h2 id="map-travel-title">{landmark.label}</h2>
          </div>
          <button
            type="button"
            className="map-icon-button"
            aria-label="Cancel travel selection"
            disabled={pending || arrivalConfirmed}
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </header>

        <p className="map-travel-route">
          <MapPin size={16} aria-hidden="true" />
          <span>{originName}</span>
          <span aria-hidden="true">→</span>
          <strong>{destination?.name ?? districtName}</strong>
        </p>

        {isLoadingDestination ? (
          <p className="map-travel-status" role="status">
            Loading destination…
          </p>
        ) : destinationLoadError ? (
          <div className="map-travel-notice" role="alert">
            <p>Destination information could not be loaded.</p>
            <button type="button" onClick={onRetryDestination}>
              Retry destination lookup
            </button>
          </div>
        ) : !destination ? (
          <p className="map-travel-notice" role="status">
            This landmark is not connected to an active travel destination yet.
          </p>
        ) : !destinationIsPlayable ? (
          <p className="map-travel-notice" role="status">
            Travel is not available here yet because this destination does not have a playable
            neighborhood.
          </p>
        ) : (
          <>
            <div className="map-travel-eligibility" aria-live="polite">
              {offline ? (
                <p role="status">Reconnect to check eligibility and travel.</p>
              ) : accessCheckPending ? (
                <p role="status">Checking destination access…</p>
              ) : restricted ? (
                <p role="alert">This place is restricted for your character.</p>
              ) : accessCheckFailed ? (
                <div role="alert">
                  <p>Destination access could not be verified.</p>
                  <button
                    type="button"
                    disabled={detailsQuery.isFetching}
                    onClick={() => void detailsQuery.refetch()}
                  >
                    {detailsQuery.isFetching ? "Checking…" : "Retry access check"}
                  </button>
                </div>
              ) : alreadyHere ? (
                <p role="status">Your character is already at this destination.</p>
              ) : levelLocked ? (
                <p role="status">Reach level {destination.level_required} to travel here.</p>
              ) : (
                <p role="status">Destination access confirmed.</p>
              )}
            </div>

            {modes.length > 0 ? (
              <fieldset className="map-travel-modes">
                <legend>Available transport</legend>
                <div role="radiogroup" aria-label="Available transport">
                  {modes.map((mode) => {
                    const trip = estimateTrip(
                      mode,
                      destination.travel_fare,
                      destination.travel_minutes,
                    );
                    const minutes = adjustedTripMinutes(trip.minutes, mode, gameTime);
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selectedMode === mode}
                        disabled={
                          offline ||
                          pending ||
                          arrivalConfirmed ||
                          accessCheckPending ||
                          accessCheckFailed ||
                          restricted ||
                          alreadyHere ||
                          levelLocked
                        }
                        onClick={() => setSelectedMode(mode)}
                      >
                        <strong>{TRAVEL_MODE_DETAILS[mode].label}</strong>
                        <small>{TRAVEL_MODE_DETAILS[mode].hint}</small>
                        <span>
                          {formatMapNaira(trip.fare)} · {minutes} min estimate
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <p className="map-travel-notice" role="status">
                No transport modes are configured for this destination.
              </p>
            )}

            {selectedMode && estimate && estimatedMinutes !== null && (
              <dl className="map-travel-estimate">
                <div>
                  <dt>
                    <Wallet size={15} aria-hidden="true" /> Your balance
                  </dt>
                  <dd>
                    {walletBalance === null
                      ? walletLoading
                        ? "Loading…"
                        : "Verified when you travel"
                      : formatMapNaira(walletBalance)}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Navigation size={15} aria-hidden="true" /> Estimated fare
                  </dt>
                  <dd>{formatMapNaira(estimate.fare)}</dd>
                </div>
                <div>
                  <dt>
                    <Clock3 size={15} aria-hidden="true" /> Journey duration
                  </dt>
                  <dd>{estimatedMinutes} game minutes</dd>
                </div>
              </dl>
            )}
          </>
        )}

        {error && (
          <p className="map-travel-error" role="alert">
            {error}
          </p>
        )}

        {arrivalConfirmed ? (
          <div className="map-travel-actions">
            <p className="map-travel-status" role="status">
              Travel is confirmed. Loading your saved destination…
            </p>
            {error && (
              <button
                type="button"
                className="map-primary-button"
                disabled={refreshingArrival}
                onClick={onRetryArrival}
              >
                {refreshingArrival ? "Refreshing destination…" : "Retry destination loading"}
              </button>
            )}
          </div>
        ) : (
          <div className="map-travel-actions">
            <button
              type="button"
              className="map-primary-button"
              disabled={!canTravel}
              onClick={() => selectedMode && onConfirm(selectedMode)}
            >
              <Navigation size={17} aria-hidden="true" />
              {pending ? "Confirming travel…" : "Confirm and travel"}
            </button>
            <button
              type="button"
              className="map-travel-details-button"
              disabled={pending}
              onClick={onOpenDetails}
            >
              Place details and activities
            </button>
            <button
              type="button"
              className="map-travel-cancel-button"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
