import type { MapLocation } from "@/lib/game";
import { LOCATION_ICONS, locationTypeColour } from "@/lib/location-service";

function safeImageUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function LocationPopup({ location }: { location: MapLocation }) {
  const Icon = LOCATION_ICONS[location.icon] ?? LOCATION_ICONS[location.type] ?? MapPin;
  const imageUrl = safeImageUrl(location.image_url);

  return (
    <article className="location-popup-card">
      {imageUrl && <img className="location-popup-image" src={imageUrl} alt="" loading="lazy" />}
      <div className="location-popup-content">
        <div className="location-popup-heading">
          <span
            className="location-popup-icon"
            style={{ backgroundColor: locationTypeColour(location.type) }}
          >
            <Icon aria-hidden="true" size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="location-popup-name">{location.name}</h3>
            <span className="location-popup-type">{location.type}</span>
          </div>
        </div>
        <p className="location-popup-description">
          {location.description || "More details about this location are coming soon."}
        </p>
        <p className="location-popup-level">
          <span>Entry level</span>
          <strong>{location.level_required}</strong>
        </p>
      </div>
    </article>
  );
}
