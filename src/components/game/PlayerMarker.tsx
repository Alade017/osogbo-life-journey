import { useEffect } from "react";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { MapLocation } from "@/lib/game";

function hasCoordinates(
  location: MapLocation | null | undefined,
): location is MapLocation & { latitude: number; longitude: number } {
  return (
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude)
  );
}

export function PlayerMarker({
  map,
  location,
}: {
  map: MapLibreMap;
  location: MapLocation | null;
}) {
  useEffect(() => {
    if (!hasCoordinates(location)) return;

    const element = document.createElement("div");
    element.className = "player-map-marker";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", `Your current location: ${location.name}`);
    element.title = `You are in ${location.name}`;

    const pulse = document.createElement("span");
    pulse.className = "player-map-marker-pulse";
    const dot = document.createElement("span");
    dot.className = "player-map-marker-dot";
    element.append(pulse, dot);

    const marker = new Marker({ element, anchor: "center" })
      .setLngLat([location.longitude, location.latitude])
      .addTo(map);

    return () => marker.remove();
  }, [location, map]);

  return null;
}
