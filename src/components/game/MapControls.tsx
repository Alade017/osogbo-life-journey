import { useState } from "react";
import { LocateFixed } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapLocation } from "@/lib/game";

const OSOGBO_CENTER: [number, number] = [4.556, 7.7677];

function hasCoordinates(
  location: MapLocation | null,
): location is MapLocation & { latitude: number; longitude: number } {
  return (
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude)
  );
}

export function MapControls({
  map,
  playerLocation,
}: {
  map: MapLibreMap;
  playerLocation: MapLocation | null;
}) {
  const [announcement, setAnnouncement] = useState("");
  const hasPlayerCoordinates = hasCoordinates(playerLocation);

  function recenter() {
    if (hasPlayerCoordinates && playerLocation) {
      map.flyTo({ center: [playerLocation.longitude, playerLocation.latitude], zoom: 15 });
      setAnnouncement(`Centered on your location in ${playerLocation.name}.`);
      return;
    }

    map.flyTo({ center: OSOGBO_CENTER, zoom: 13 });
    setAnnouncement(
      playerLocation
        ? `${playerLocation.name} has no mapped coordinates yet. Centered on Osogbo.`
        : "Your current district has no mapped coordinates yet. Centered on Osogbo.",
    );
  }

  return (
    <>
      <button
        type="button"
        className="osogbo-map-recenter"
        onClick={recenter}
        aria-label={hasPlayerCoordinates ? "Center map on your location" : "Center map on Osogbo"}
        title={hasPlayerCoordinates ? "Center on your location" : "Center on Osogbo"}
      >
        <LocateFixed aria-hidden="true" size={19} />
        <span>{hasPlayerCoordinates ? "My location" : "Osogbo"}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
