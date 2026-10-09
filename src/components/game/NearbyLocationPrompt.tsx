import { useEffect, useState } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import type { NearbyLocation } from "@/lib/nearby-location-service";
import { requestLocationInteraction } from "@/lib/nearby-location-service";
import { LOCATION_CATEGORIES } from "@/lib/location-service";

export function NearbyLocationPrompt({
  nearbyLocations,
}: {
  nearbyLocations: readonly NearbyLocation[];
}) {
  const closest = nearbyLocations[0] ?? null;
  const [requestedLocationId, setRequestedLocationId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedLocationId && requestedLocationId !== closest?.location.id) {
      setRequestedLocationId(null);
    }
  }, [closest?.location.id, requestedLocationId]);

  if (!closest) return null;
  const { location, distanceMeters, meetsLevelRequirement } = closest;
  const CategoryIcon = LOCATION_CATEGORIES[location.category].icon;
  const distanceLabel =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)} m away`
      : `${(distanceMeters / 1000).toFixed(1)} km away`;

  return (
    <section className="nearby-location-prompt" aria-label="Nearby location" aria-live="polite">
      <div className="nearby-location-prompt-icon" aria-hidden="true">
        <CategoryIcon size={19} />
      </div>
      <div className="nearby-location-prompt-copy">
        <strong>You're near {location.name}</strong>
        <span>
          {distanceLabel}
          {nearbyLocations.length > 1 ? ` · ${nearbyLocations.length - 1} more nearby` : ""}
        </span>
        {!meetsLevelRequirement && <small>Requires level {location.level_required}</small>}
        {requestedLocationId === location.id && meetsLevelRequirement && (
          <small role="status">Ready to interact with {location.name}.</small>
        )}
      </div>
      <button
        type="button"
        disabled={!meetsLevelRequirement}
        aria-label={
          meetsLevelRequirement
            ? `Interact with ${location.name}`
            : `Requires level ${location.level_required}`
        }
        onClick={() => {
          requestLocationInteraction({ location, distanceMeters });
          setRequestedLocationId(location.id);
        }}
      >
        {meetsLevelRequirement ? (
          <>
            <span>Interact</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </>
        ) : (
          <LockKeyhole size={16} aria-hidden="true" />
        )}
      </button>
    </section>
  );
}
