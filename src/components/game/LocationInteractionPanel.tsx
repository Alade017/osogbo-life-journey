import { useState } from "react";
import type { CityLocationData, LocationActionDefinition } from "@/lib/location-service";
import { LOCATION_CATEGORIES } from "@/lib/location-service";
import { LocationCard } from "@/components/game/LocationCard";
import { Link } from "@tanstack/react-router";

const SUGGESTED_ACTIONS: Partial<Record<CityLocationData["category"], string[]>> = {
  bank: ["View bank services", "Deposit money", "Withdraw money"],
  hospital: ["Visit a doctor", "Get treatment", "Buy medicine"],
  police: ["Visit police station", "Report an incident"],
  market: ["Enter the market", "Shop", "View vendors"],
  restaurant: ["View menu", "Order a meal"],
  fuel_station: ["Refuel", "View fuel prices"],
  school: ["View courses", "Visit campus"],
  business: ["View services", "Apply for work"],
  government: ["View public services"],
  entertainment: ["View events", "Enter venue"],
  park: ["Explore the park"],
  cultural_landmark: ["Explore landmark"],
  transportation: ["View transport options"],
  home: ["View home options"],
};

function getActions(location: CityLocationData): LocationActionDefinition[] {
  if (location.availableActions.length) return location.availableActions;
  return (SUGGESTED_ACTIONS[location.category] ?? ["Explore location"]).map((label) => ({
    id: `planned-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    label,
    status: "coming_soon",
  }));
}

export function LocationInteractionPanel({ location }: { location: CityLocationData }) {
  const [selectedAction, setSelectedAction] = useState<LocationActionDefinition | null>(null);
  const category = LOCATION_CATEGORIES[location.category].singular;

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
      {selectedAction ? (
        <div className="location-interaction-placeholder" role="status" aria-live="polite">
          <p className="location-interaction-placeholder-title">{selectedAction.label}</p>
          <p>
            {selectedAction.status === "coming_soon"
              ? `${selectedAction.label} at this ${category.toLowerCase()} is coming soon.`
              : "This interaction is configured for this location but is not connected to a game service yet."}
          </p>
          <button type="button" onClick={() => setSelectedAction(null)}>
            Back to {location.name}
          </button>
        </div>
      ) : (
        <>
          <div className="location-interaction-actions">
            <a href={`/location/${encodeURIComponent(location.slug)}`}>
              View district and travel options
            </a>
            <ul aria-label={`${location.name} actions`}>
              {getActions(location).map((action) => (
                <li key={action.id}>
                  <button type="button" onClick={() => setSelectedAction(action)}>
                    <span>{action.label}</span>
                    <small>{action.status === "available" ? "Configured" : "Coming soon"}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
