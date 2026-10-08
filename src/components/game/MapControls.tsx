import { useState } from "react";
import { LocateFixed } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PlayerLocation } from "@/lib/player-location";

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
  const canCenterOnPlayer = hasPlayerCoordinates(playerLocation);

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
