import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { BadgeCheck, MapPin, X } from "lucide-react";
import { formatMapNaira, formatMapEventEnd } from "@/components/map/map-ui-utils";
import { MapApiError, requestMapLandmark } from "@/lib/map-api";
import { careerShiftPay } from "@/lib/economy-service";
import { isCareerJob } from "@/lib/career-rules";
import { PlaceActionMenu, type PlaceActionResult } from "@/components/map/PlaceActionMenu";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";

export function LandmarkSheet({
  landmark,
  accountId,
  characterId,
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
  event,
}: {
  accountId?: string | undefined;
  characterId?: string | undefined;
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
  event?: { label: string; endsAt: string } | null;
}) {
  const detailsQuery = useQuery({
    queryKey: ["mapLandmarkDetails", landmark.id, accountId, characterId],
    queryFn: () => {
      if (!accountId) throw new Error("Player account is not ready.");
      return requestMapLandmark(landmark.id, accountId);
    },
    enabled: !!accountId && !offline,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
  const scheduleIsFresh =
    !!detailsQuery.data?.schedule &&
    !offline &&
    !detailsQuery.isFetching &&
    Date.now() - detailsQuery.dataUpdatedAt <= 30_000;
  const schedule = scheduleIsFresh ? detailsQuery.data?.schedule : undefined;
  const restricted =
    detailsQuery.error instanceof MapApiError && detailsQuery.error.code === "AGE_RESTRICTED";
  const detailError =
    detailsQuery.error instanceof MapApiError && detailsQuery.error.code !== "AGE_RESTRICTED"
      ? detailsQuery.error.code
      : undefined;
  const canAct = !!detailsQuery.data && !offline && !pending && !detailsQuery.isFetching;
  const isHere =
    !!detailsQuery.data &&
    !offline &&
    !detailsQuery.isFetching &&
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
      {event && (
        <p className="map-here-note">
          {event.label} · Until {formatMapEventEnd(event.endsAt)}
        </p>
      )}
      <p className="map-location-line">
        <MapPin size={15} aria-hidden="true" /> Located in {locationName}
      </p>
      {isHere && <p className="map-here-note">You are here</p>}
      {(restricted || (detailsQuery.data?.landmark.min_age ?? 0) >= 18) && (
        <p className="map-age-badge">
          <BadgeCheck size={15} /> 18+
        </p>
      )}
      {!accountId ? (
        <p role="status">Loading player details…</p>
      ) : offline && detailsQuery.isPending ? (
        <p role="status">Reconnect to load place details and activity hours.</p>
      ) : detailsQuery.isPending ? (
        <p role="status">Loading place details…</p>
      ) : restricted ? (
        <p className="map-age-notice">This place is for players 18 and over.</p>
      ) : detailError ? (
        <div role="alert" className="map-action-error">
          <p>
            {detailError === "UNKNOWN_LANDMARK"
              ? "This place is no longer available."
              : "Place details could not be loaded. Reconnect and try again."}
          </p>
          {detailError !== "UNKNOWN_LANDMARK" && (
            <button
              type="button"
              disabled={offline || detailsQuery.isFetching}
              onClick={() => void detailsQuery.refetch()}
            >
              {offline
                ? "Reconnect to retry"
                : detailsQuery.isFetching
                  ? "Refreshing…"
                  : "Retry place details"}
            </button>
          )}
        </div>
      ) : (
        <>
          <PlaceActionMenu
            schedule={schedule}
            refreshingSchedule={detailsQuery.isFetching}
            onRefreshSchedule={() => void detailsQuery.refetch()}
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
                        {isCareerJob(job.slug) ? (
                          <>Career path · three ranks · see Jobs for pay</>
                        ) : (
                          <>
                            {formatMapNaira(careerShiftPay(job.salary, 1))}–
                            {formatMapNaira(careerShiftPay(job.salary, 3))} per shift
                          </>
                        )}
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
