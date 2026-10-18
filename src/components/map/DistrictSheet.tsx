import { useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import type { MapDistrict } from "@/components/map/OsogboMap.svg";
import { formatGameHourInLagos, formatMapEventEnd } from "@/components/map/map-ui-utils";

export function DistrictSheet({
  district,
  event,
  onClose,
  onLandmark,
}: {
  district: MapDistrict;
  event?: { label: string; endsAt?: string; endHour?: number } | null;
  onClose: () => void;
  onLandmark: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const start = useRef<number | null>(null);
  const begin = (e: PointerEvent<HTMLButtonElement>) => {
    start.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const end = (e: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const delta = e.clientY - start.current;
    if (delta < -45) setExpanded(true);
    if (delta > 70) {
      if (expanded) setExpanded(false);
      else onClose();
    }
    start.current = null;
  };
  const trafficLabel = `${district.traffic[0]!.toUpperCase()}${district.traffic.slice(1)} traffic`;
  if (typeof document === "undefined") return null;

  return createPortal(
    <section
      className={`map-sheet ${expanded ? "is-expanded" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-sheet-title"
    >
      <button
        className="map-sheet-grabber"
        onPointerDown={begin}
        onPointerUp={end}
        aria-label="Drag to expand or close sheet"
      >
        <span />
      </button>
      <header className="map-sheet-header">
        <div>
          <p className="map-sheet-eyebrow">{district.theme} district</p>
          <h2 id="map-sheet-title">{district.name}</h2>
        </div>
        <button className="map-icon-button" onClick={onClose} aria-label="Close district details">
          <X size={18} />
        </button>
      </header>
      <p>{district.description}</p>
      <div className="map-traffic" aria-label={trafficLabel}>
        <span className={`traffic-bars traffic-${district.traffic}`}>
          <i />
          <i />
          <i />
        </span>
        <strong>{trafficLabel}</strong>
      </div>
      {event && (
        <p className="map-event-status">
          <MapPin size={15} />
          <span>
            {event.label}
            {event.endsAt
              ? `, ends ${formatMapEventEnd(event.endsAt)}`
              : event.endHour !== undefined
                ? `, ends ${formatGameHourInLagos(event.endHour)}`
                : ""}
          </span>
        </p>
      )}
      <h3>Landmarks</h3>
      <ul className="map-sheet-list">
        {district.landmarks.map((place) => (
          <li key={place.id}>
            <button onClick={() => onLandmark(place.id)}>
              {place.label}
              <span>Open details</span>
            </button>
          </li>
        ))}
      </ul>
    </section>,
    document.body,
  );
}
