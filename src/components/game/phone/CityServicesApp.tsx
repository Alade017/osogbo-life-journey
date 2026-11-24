import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, MapPin, Search, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { q } from "@/lib/game";
import "./city-services-app.css";

function labelForType(type: string | null | undefined) {
  if (!type) return "Other places";
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** A live directory of the town's configured destinations; it never invents service locations. */
export function CityServicesApp() {
  const placesQuery = useQuery(q.locations());
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const places = placesQuery.data ?? [];
  const types = useMemo(
    () => [...new Set(places.map((place) => place.type ?? "other"))].sort(),
    [places],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const visiblePlaces = places.filter((place) => {
    const matchesType = selectedType === null || (place.type ?? "other") === selectedType;
    const matchesSearch = [place.name, place.tagline, labelForType(place.type)].some((value) =>
      value?.toLowerCase().includes(normalizedSearch),
    );
    return matchesType && matchesSearch;
  });

  return (
    <div className="phone-local-app city-services-app" aria-label="City services directory">
      <header className="city-services-hero">
        <span className="city-services-icon" aria-hidden="true">
          <HeartPulse />
        </span>
        <span>
          <strong>City Services</strong>
          <small>Find useful places and services around town</small>
        </span>
      </header>

      <div className="city-services-trust">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Live town directory</span>
        <span>{places.length} places</span>
      </div>

      <label className="city-services-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search city services"
          placeholder="Search clinics, banks, offices…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="city-services-filters" role="group" aria-label="Filter services by type">
        <button
          type="button"
          aria-pressed={selectedType === null}
          onClick={() => setSelectedType(null)}
        >
          All
        </button>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={selectedType === type}
            onClick={() => setSelectedType(type)}
          >
            {labelForType(type)}
          </button>
        ))}
      </div>

      {placesQuery.isPending && (
        <p className="city-services-state" role="status">
          Loading town services…
        </p>
      )}
      {placesQuery.isError && (
        <div className="city-services-state" role="alert">
          <p>The town directory could not be loaded.</p>
          <button type="button" onClick={() => void placesQuery.refetch()}>
            Try again
          </button>
        </div>
      )}
      {!placesQuery.isPending && !placesQuery.isError && visiblePlaces.length === 0 && (
        <p className="city-services-state">No places match this search.</p>
      )}

      <div className="city-services-list">
        {visiblePlaces.map((place) => (
          <article className="city-services-card" key={place.id}>
            <span className="city-services-card-icon" aria-hidden="true">
              <MapPin />
            </span>
            <div className="city-services-card-copy">
              <small>{labelForType(place.type)}</small>
              <strong>{place.name}</strong>
              {place.tagline && <p>{place.tagline}</p>}
              <Link to="/location/$slug" params={{ slug: place.slug }}>
                View destination
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default CityServicesApp;
