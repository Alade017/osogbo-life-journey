import { useMemo, useState } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PlayerLocation } from "@/lib/player-location";
import { q } from "@/lib/game";

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
  const { data: locations } = useQuery(q.mapLocations());
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return [];
    return (locations ?? [])
      .filter(
        (location) =>
          typeof location.latitude === "number" &&
          typeof location.longitude === "number" &&
          location.name.toLocaleLowerCase().includes(term),
      )
      .slice(0, 5);
  }, [locations, search]);
  const canCenterOnPlayer = hasPlayerCoordinates(playerLocation);

  function selectLocation(location: (typeof matches)[number]) {
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
          if (matches[0]) selectLocation(matches[0]);
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
            {matches.length ? (
              matches.map((location) => (
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
            ) : (
              <p>No mapped places found</p>
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
