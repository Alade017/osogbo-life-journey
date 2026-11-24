import "./phone-map.css";
import { useState } from "react";
import { MapPinned, Search } from "lucide-react";
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

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = [...new Set((places ?? []).map((place) => typeLabel(place.type)))].sort();
  const query = search.trim().toLowerCase();
  const visiblePlaces = (places ?? []).filter((place) =>
    (!category || typeLabel(place.type) === category) &&
    [place.name, place.tagline, typeLabel(place.type)].some((value) => value?.toLowerCase().includes(query)),
  );

  return (
    <div className="phone-local-app map-app" aria-label="Places to explore">
      <header>
        <MapPinned aria-hidden="true" />
        <span>
          <strong>Map</strong>
          <small>Places you can explore in town</small>
        </span>
      </header>
      <Button asChild variant="plain" className="phone-map-open">
        <a href="/map">Open full city map</a>
      </Button>
      <label className="phone-map-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" aria-label="Search destinations" placeholder="Search destinations" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="phone-map-filters" role="group" aria-label="Destination categories">
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>All</button>
        {categories.map((type) => <button key={type} type="button" aria-pressed={category === type} onClick={() => setCategory(type)}>{type}</button>)}
      </div>
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
          {places.length > 0 && visiblePlaces.length === 0 && <p className="phone-map-state" role="status">No destinations match your filters.</p>}
          {visiblePlaces.map((place) => {
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
