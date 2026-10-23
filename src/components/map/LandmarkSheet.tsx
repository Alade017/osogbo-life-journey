import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { BadgeCheck, MapPin, X } from "lucide-react";
import { formatMapNaira } from "@/components/map/map-ui-utils";
import { MapApiError, requestMapLandmark } from "@/lib/map-api";
import { careerShiftPay } from "@/lib/economy-service";
import { PlaceActionMenu, type PlaceActionResult } from "@/components/map/PlaceActionMenu";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";

export function LandmarkSheet({
  landmark,
  description,
  offline,
  onClose,
  onTravel,
  onApply,
  travelResult,
  pending,
  error,
  onRunPlaceAction,
  actionPending,
  actionResult,
  locationName,
}: {
  landmark: {
    id: string;
    label: string;
    category: string;
    verify: boolean;
    actions?: MapPlaceAction[];
  };
  description: string;
  offline: boolean;
  onClose: () => void;
  onTravel: (landmarkId: string) => void;
  onApply: (jobId: string) => void;
  travelResult?: { fare: number; travel_minutes: number; landmark_id: string } | null;
  pending: boolean;
  error?: string;
  onRunPlaceAction: (actionId: string) => void;
  actionPending: boolean;
  actionResult?: PlaceActionResult | null;
  locationName: string;
}) {
  const detailsQuery = useQuery({
    queryKey: ["mapLandmarkDetails", landmark.id],
    queryFn: () => requestMapLandmark(landmark.id),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const restricted =
    detailsQuery.error instanceof MapApiError && detailsQuery.error.code === "AGE_RESTRICTED";
  const detailError =
    detailsQuery.error instanceof MapApiError && detailsQuery.error.code !== "AGE_RESTRICTED"
      ? detailsQuery.error.code
      : undefined;
  const canAct = !!detailsQuery.data && !offline && !pending;
  const isHere =
    !!detailsQuery.data &&
    detailsQuery.data.landmark.player_location_id === detailsQuery.data.landmark.location_id;

  if (typeof document === "undefined") return null;

  return createPortal(
    <section
      className="map-sheet map-landmark-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-landmark-title"
    >
      <div className="map-sheet-grabber-static">
        <span />
      </div>
      <header className="map-sheet-header">
        <div>
          <p className="map-sheet-eyebrow">{landmark.category}</p>
          <h2 id="map-landmark-title">{landmark.label}</h2>
        </div>
        <button className="map-icon-button" onClick={onClose} aria-label="Close landmark details">
          <X size={18} />
        </button>
      </header>
      <p>{detailsQuery.data?.landmark.description ?? description}</p>
      <p className="map-location-line">
        <MapPin size={15} aria-hidden="true" /> Located in {locationName}
      </p>
      {isHere && <p className="map-here-note">You are here</p>}
      {(restricted || (detailsQuery.data?.landmark.min_age ?? 0) >= 18) && (
        <p className="map-age-badge">
          <BadgeCheck size={15} /> 18+
        </p>
      )}
      {detailsQuery.isPending ? (
        <p role="status">Loading place details…</p>
      ) : restricted ? (
        <p className="map-age-notice">This place is for players 18 and over.</p>
      ) : detailError ? (
        <p role="alert" className="map-action-error">
          {detailError === "UNKNOWN_LANDMARK"
            ? "This place is no longer available."
            : "Place details could not be loaded. Reconnect and try again."}
        </p>
      ) : (
        <>
          <PlaceActionMenu
            actions={detailsQuery.data?.actions ?? []}
            offline={offline}
            pending={actionPending}
            isHere={isHere}
            result={actionResult}
            onRun={onRunPlaceAction}
          />
          <section>
            <h3>Other activities</h3>
            {detailsQuery.data?.activities.length ? (
              <ul className="map-sheet-list">
                {detailsQuery.data.activities.map((activity) => (
                  <li key={activity.id}>
                    <span>{activity.name}</span>
                    <small>{activity.description}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No activities are listed here yet.</p>
            )}
          </section>
          <section>
            <h3>Available jobs</h3>
            {detailsQuery.data?.jobs.length ? (
              <ul className="map-sheet-list">
                {detailsQuery.data.jobs.map((job) => (
                  <li key={job.id}>
                    <span>
                      {job.name}
                      <small>
                        {formatMapNaira(careerShiftPay(job.salary, 1))}–
                        {formatMapNaira(careerShiftPay(job.salary, 3))} per shift
                      </small>
                    </span>
                    <button disabled={!canAct} onClick={() => onApply(job.id)}>
                      {offline ? "Reconnect to apply" : "Apply"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No open jobs here.</p>
            )}
          </section>
        </>
      )}
      {error && (
        <p role="alert" className="map-action-error">
          {error}
        </p>
      )}
      <footer className="map-sheet-actions">
        <button
          className="map-primary-button"
          disabled={!canAct || restricted || isHere}
          aria-disabled={isHere || undefined}
          onClick={() => onTravel(landmark.id)}
        >
          <MapPin size={17} />
          {offline
            ? "Reconnect to travel"
            : isHere
              ? "You are here"
              : restricted
                ? "This place is for players 18 and over."
                : pending
                  ? "Requesting route…"
                  : "Travel here"}
        </button>
        {travelResult && (
          <p role="status">
            Travel started: {travelResult.travel_minutes} min · {formatMapNaira(travelResult.fare)}
          </p>
        )}
      </footer>
    </section>,
    document.body,
  );
}
