import { useMemo, useState } from "react";
import { BadgeCheck, MapPin, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Activity, Job, MapLocation } from "@/lib/game";
import { careerShiftPay, q } from "@/lib/game";
import { formatMapNaira } from "@/components/map/map-ui-utils";

export function LandmarkSheet({
  landmark,
  description,
  location,
  offline,
  playerAge,
  onClose,
  onTravel,
  onApply,
  travelResult,
  pending,
  error,
}: {
  landmark: { id: string; label: string; category: string; verify: boolean };
  description: string;
  location: MapLocation | null | undefined;
  offline: boolean;
  playerAge: number | null;
  onClose: () => void;
  onTravel: (id: string, mode: string) => void;
  onApply: (id: string) => void;
  travelResult?: { fare: number; travel_minutes: number; location: string } | null;
  pending: boolean;
  error?: string;
}) {
  const id = location?.id;
  const activitiesQuery = useQuery({ ...q.locationActivities(id ?? ""), enabled: !!id });
  const jobsQuery = useQuery({ ...q.locationJobs(id ?? ""), enabled: !!id });
  const [mode, setMode] = useState("walking");
  const restricted = useMemo(() => {
    const metadata = location?.metadata as Record<string, unknown> | null;
    const flags = metadata?.["flags"];
    return (
      Number(metadata?.["min_age"] ?? 0) >= 18 || (Array.isArray(flags) && flags.includes("18+"))
    );
  }, [location]);
  const tooYoung = restricted && (playerAge === null || playerAge < 18);
  return (
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
      <p>{description}</p>
      {restricted && (
        <p className="map-age-badge">
          <BadgeCheck size={15} /> 18+
        </p>
      )}
      <section>
        <h3>Activities</h3>
        {activitiesQuery.isPending ? (
          <p>Loading activities…</p>
        ) : activitiesQuery.data?.length ? (
          <ul className="map-sheet-list">
            {activitiesQuery.data.map((activity: Activity) => (
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
        {jobsQuery.isPending ? (
          <p>Loading jobs…</p>
        ) : jobsQuery.data?.length ? (
          <ul className="map-sheet-list">
            {jobsQuery.data.map((job: Job) => (
              <li key={job.id}>
                <span>
                  {job.name}
                  <small>
                    {formatMapNaira(careerShiftPay(job.salary, 1))}–
                    {formatMapNaira(careerShiftPay(job.salary, 3))} per shift
                  </small>
                </span>
                <button disabled={offline || pending || tooYoung} onClick={() => onApply(job.id)}>
                  {offline ? "Reconnect to apply" : "Apply"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No open jobs here.</p>
        )}
      </section>
      {tooYoung && <p className="map-age-notice">This place is for players 18 and over.</p>}
      {error && (
        <p role="alert" className="map-action-error">
          {error}
        </p>
      )}
      <footer className="map-sheet-actions">
        <label>
          Travel mode{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="walking">Walking</option>
            <option value="danfo">Danfo</option>
            <option value="keke">Keke</option>
            <option value="okada">Okada</option>
            <option value="car">Car</option>
          </select>
        </label>
        <button
          className="map-primary-button"
          disabled={!id || offline || pending || tooYoung}
          onClick={() => id && onTravel(id, mode)}
        >
          <MapPin size={17} />
          {offline
            ? "Reconnect to travel"
            : tooYoung
              ? "This place is for players 18 and over."
              : !id
                ? "Not a playable destination"
                : pending
                  ? "Requesting route…"
                  : "Travel here"}
        </button>
        {travelResult && (
          <p role="status">
            {travelResult.location}: {travelResult.travel_minutes} min ·{" "}
            {formatMapNaira(travelResult.fare)}
          </p>
        )}
      </footer>
    </section>
  );
}
