import { useCityEvents } from "@/hooks/use-city-events";

/** A scrolling strip of live and upcoming city events. Renders nothing when there are none. */
export function MapTicker() {
  const { data, isError } = useCityEvents();
  if (isError) return null;

  const items = (data?.events ?? []).filter(
    (event) => event.status === "active" || event.status === "upcoming",
  );
  if (items.length === 0) return null;

  const line = items.map((event) => `${event.title} · ${event.locationName}`).join("   •   ");

  return (
    <div className="map-ticker" aria-label="City events">
      <span className="map-ticker-label">Live</span>
      <div className="map-ticker-viewport">
        <div className="map-ticker-track">
          <span>{line}</span>
          <span aria-hidden="true">{line}</span>
        </div>
      </div>
    </div>
  );
}
