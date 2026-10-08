import type { ReactNode } from "react";
import type { CityLocationData } from "@/lib/location-service";
import { LOCATION_CATEGORIES, LOCATION_ICONS } from "@/lib/location-service";
import { cn } from "@/lib/utils";

export function LocationCard({
  location,
  accessory,
  compact = false,
  showActions = true,
}: {
  location: CityLocationData;
  accessory?: ReactNode;
  compact?: boolean;
  showActions?: boolean;
}) {
  const category = location.category;
  const definition = LOCATION_CATEGORIES[category];
  const Icon =
    location.icon !== "map-pin"
      ? (LOCATION_ICONS[location.icon] ?? definition.icon)
      : definition.icon;

  return (
    <article className={cn("city-location-card", compact && "city-location-card-compact")}>
      <div className="city-location-card-heading">
        <span className="city-location-card-icon" style={{ backgroundColor: definition.colour }}>
          <Icon aria-hidden="true" size={compact ? 16 : 18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="city-location-card-category">{definition.singular}</p>
          <h3 className="city-location-card-name">{location.name}</h3>
        </div>
        {accessory ?? (
          <span
            className={`city-location-status ${location.status === "active" ? "is-active" : "is-inactive"}`}
          >
            {location.status === "active" ? "Active" : "Inactive"}
          </span>
        )}
      </div>
      {location.description && (
        <p className="city-location-card-description">{location.description}</p>
      )}
      {location.openingHours && (
        <p className="city-location-card-meta">
          <strong>Hours</strong> {location.openingHours}
        </p>
      )}
      {showActions && location.availableActions.length > 0 && (
        <div className="city-location-actions" aria-label="Location actions">
          <span className="city-location-card-meta city-location-actions-label">
            At this location
          </span>
          <ul>
            {location.availableActions.map((action) => (
              <li key={action.id}>
                <span>{action.label}</span>
                <small>{action.status === "available" ? "Available" : "Coming soon"}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {compact && location.level_required > 0 && (
        <p className="city-location-card-meta">
          <strong>Entry level</strong> {location.level_required}
        </p>
      )}
    </article>
  );
}
