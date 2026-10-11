import { useEffect, useState } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PlayerLocation } from "@/lib/player-location";
import { q, type MapLocation } from "@/lib/game";

const OSOGBO_CENTER: [number, number] = [4.556, 7.7677];

function hasPlayerCoordinates(
  playerLocation: PlayerLocation | null,
): playerLocation is PlayerLocation & { latitude: number; longitude: number } {
  return (
    typeof playerLocation?.latitude === "number" && typeof playerLocation.longitude === "number"
  );
}

export function MapControls({
  map,
  playerLocation,
}: {
  map: MapLibreMap;
  playerLocation: PlayerLocation | null;
}) {
  const [announcement, setAnnouncement] = useState("");
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const {
    data: matches,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
    refetch: retrySearch,
  } = useQuery(q.searchMapLocations(searchTerm));
  const searchResults = matches ?? [];
  const canCenterOnPlayer = hasPlayerCoordinates(playerLocation);

  function selectLocation(location: MapLocation) {
    if (typeof location.latitude !== "number" || typeof location.longitude !== "number") return;
    map.flyTo({ center: [location.longitude, location.latitude], zoom: 16 });
    setAnnouncement(`Map centered on ${location.name}.`);
    setSearch("");
  }

  function recenter() {
    if (canCenterOnPlayer) {
      map.flyTo({ center: [playerLocation.longitude, playerLocation.latitude], zoom: 15 });
      setAnnouncement(
        playerLocation.location
          ? `Centered on your location in ${playerLocation.location.name}.`
          : "Centered on your saved map position.",
      );
      return;
    }

    map.flyTo({ center: OSOGBO_CENTER, zoom: 13 });
    setAnnouncement(
      playerLocation?.location
        ? `${playerLocation.location.name} has no mapped coordinates yet. Centered on Osogbo.`
        : "Your current district has no mapped coordinates yet. Centered on Osogbo.",
    );
  }

  return (
    <>
      <form
        className="osogbo-map-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (searchResults[0]) selectLocation(searchResults[0]);
        }}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          aria-label="Search mapped places in Osogbo"
          placeholder="Find a place"
          autoComplete="off"
        />
        {search && (
          <button type="button" aria-label="Clear place search" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </button>
        )}
        {search && (
          <div className="osogbo-map-search-results" role="listbox" aria-label="Matching places">
            {searchResults.length ? (
              searchResults.map((location) => (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  key={location.id}
                  onClick={() => selectLocation(location)}
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{location.name}</span>
                </button>
              ))
            ) : isSearchFetching ? (
              <p role="status">Searching mapped places…</p>
            ) : isSearchError ? (
              <p role="alert">
                Places could not be searched. {searchError.message}{" "}
                <button type="button" onClick={() => void retrySearch()}>
                  Retry
                </button>
              </p>
            ) : (
              <p>
                {searchTerm.length < 3 ? "Type at least 3 characters" : "No mapped places found"}
              </p>
            )}
          </div>
        )}
      </form>
      <button
        type="button"
        className="osogbo-map-recenter"
        onClick={recenter}
        aria-label={canCenterOnPlayer ? "Center map on your location" : "Center map on Osogbo"}
        title={canCenterOnPlayer ? "Center on your location" : "Center on Osogbo"}
      >
        <LocateFixed aria-hidden="true" size={19} />
        <span>{canCenterOnPlayer ? "My location" : "Osogbo"}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
