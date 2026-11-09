import { MapPinned } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { Button } from "@/components/ui/button";

function typeLabel(type: string | null | undefined) {
  if (!type) return "Place";
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

/** Places in town the player can explore, read from the live locations table. */
export function PhoneMapApp() {
  const { data: places, isLoading, isError, refetch } = useQuery(q.locations());

  return (
    <div className="phone-local-app" aria-label="Places to explore">
      <header>
        <MapPinned aria-hidden="true" />
        <span>
          <strong>Map</strong>
          <small>Places you can explore in town</small>
        </span>
      </header>
      {isLoading && (
        <p role="status" className="phone-map-state">
          Loading places…
        </p>
      )}
      {isError && (
        <div role="alert" className="phone-map-state">
          <p>Places could not be loaded.</p>
          <Button variant="plain" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}
      {places && (
        <div className="phone-local-list">
          {places.length === 0 && <p className="phone-map-state">No places are open yet.</p>}
          {places.map((place) => (
            <div className="phone-local-card" key={place.id}>
              <div>
                <small>{typeLabel(place.type)}</small>
                <strong>{place.name}</strong>
                {place.tagline && <p>{place.tagline}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default PhoneMapApp;
