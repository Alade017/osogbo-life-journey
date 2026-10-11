import type { CityLocationData } from "@/lib/location-service";
import { LocationCard } from "@/components/game/LocationCard";
import { Link } from "@tanstack/react-router";

export function LocationInteractionPanel({ location }: { location: CityLocationData }) {
  return (
    <section className="location-interaction-panel" aria-label={`${location.name} interactions`}>
      <LocationCard location={location} compact showActions={false} />
      {location.category === "bank" && (
        <Link
          className="inline-flex rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground"
          to="/wallet"
        >
          Open bank services
        </Link>
      )}
      {location.category === "market" && (
        <Link
          className="inline-flex rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground"
          to="/market"
        >
          Browse shop offers
        </Link>
      )}
      <div className="location-interaction-actions">
        <Link to="/location/$slug" params={{ slug: location.slug }}>
          View district and travel options
        </Link>
        {location.availableActions.length ? (
          <ul aria-label={`${location.name} configured interactions`}>
            {location.availableActions.map((action) => (
              <li key={action.id}>
                <span>{action.label}</span>
                <small>
                  {action.status === "available" ? "Available in this area" : "Planned"}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No additional interactions are configured here yet. District travel, city jobs, bank,
            and market services remain available from their connected pages.
          </p>
        )}
      </div>
    </section>
  );
}
