import "./phone-map.css";
import { MapPinned } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";

const landmarkByLocation = new Map(
  Object.entries(MAP_LANDMARK_LOCATION_SLUG).flatMap(([landmark, slug]) =>
    slug ? [[slug, landmark] as const] : [],
  ),
);

function typeLabel(type: string | null | undefined) {
  if (!type) return "Place";
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

/** Places in town the player can explore, read from the live locations table. */
export function PhoneMapApp() {
  const { data: places, isLoading, isError, refetch } = useQuery(q.locations());

  return (
    <div className="phone-local-app map-app" aria-label="Places to explore">
      <header>
        <MapPinned aria-hidden="true" />
        <span>
          <strong>Map</strong>
          <small>Places you can explore in town</small>
        </span>
      </header>
      <Button asChild variant="plain">
        <a href="/map">Open full city map</a>
      </Button>
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
          {places.map((place) => {
            const landmark = landmarkByLocation.get(place.slug);
            return (
              <div className="phone-local-card" key={place.id}>
                <div>
                  <small>{typeLabel(place.type)}</small>
                  <strong>{place.name}</strong>
                  {place.tagline && <p>{place.tagline}</p>}
                  <div className="phone-map-destination-actions">
                    <Link
                      to="/location/$slug"
                      params={{ slug: place.slug }}
                      aria-label={`View destination: ${place.name}`}
                    >
                      View destination
                    </Link>
                    {landmark && (
                      <a
                        href={"/map?" + new URLSearchParams({ landmark, details: "1" })}
                        aria-label={`Locate ${place.name} on map`}
                      >
                        Locate on map
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default PhoneMapApp;
