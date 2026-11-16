import type { UseQueryResult } from "@tanstack/react-query";
import { BadgeCheck, MapPin } from "lucide-react";
import { formatMapNaira, formatMapEventEnd } from "@/components/map/map-ui-utils";
import { MapApiError, type MapLandmarkDetails } from "@/lib/map-api";
import { careerShiftPay } from "@/lib/economy-service";
import { isCareerJob } from "@/lib/career-rules";
import { PlaceActionMenu, type PlaceActionResult } from "@/components/map/PlaceActionMenu";
import type { MapPlaceAction } from "@/components/map/map-types";

export function LandmarkDetailsContent({
  detailsQuery,
  landmark,
  accountId,
  characterId,
  description,
  offline,
  onApply,
  pending,
  error,
  onRunPlaceAction,
  actionPending,
  actionResult,
  locationName,
  event,
}: {
  detailsQuery: UseQueryResult<MapLandmarkDetails, Error>;
  accountId?: string | undefined;
  characterId?: string | undefined;
  landmark: {
    id: string;
    label: string;
    category: string;
    verify?: boolean;
    actions?: MapPlaceAction[];
  };
  description: string;
  offline: boolean;
  onApply: (jobId: string) => void;
  pending: boolean;
  error?: string;
  onRunPlaceAction: (actionId: string) => void;
  actionPending: boolean;
  actionResult?: PlaceActionResult | null;
  locationName: string;
  event?: { label: string; endsAt: string } | null;
}) {
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

  return (
    <div className="destination-details">
      <p className="map-landmark-description">
        {detailsQuery.data?.landmark.description ?? description}
      </p>
      {event && (
        <p className="map-here-note map-landmark-event">
          {event.label} · Until {formatMapEventEnd(event.endsAt)}
        </p>
      )}
      <div className="map-landmark-meta" aria-label="Location details">
        <span className="map-landmark-chip map-landmark-place">
          <MapPin size={14} aria-hidden="true" /> {locationName}
        </span>
        {isHere ? (
          <span className="map-landmark-chip is-current">You are here</span>
        ) : (
          <span className="map-landmark-chip">Open to visit</span>
        )}
        {(restricted || (detailsQuery.data?.landmark.min_age ?? 0) >= 18) && (
          <span className="map-landmark-chip map-landmark-age">
            <BadgeCheck size={14} /> 18+
          </span>
        )}
      </div>
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
            pending={actionPending || pending}
            isHere={isHere}
            result={actionResult}
            onRun={onRunPlaceAction}
          />
          <section className="map-landmark-section map-landmark-activities">
            <h3>Other activities</h3>
            {detailsQuery.data?.activities?.length ? (
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
          <section className="map-landmark-section map-landmark-jobs">
            <h3>Available jobs</h3>
            {detailsQuery.data?.jobs?.length ? (
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
    </div>
  );
}
