import { useEffect } from "react";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { PlayerLocation } from "@/lib/player-location";

export function PlayerMarker({
  map,
  playerLocation,
}: {
  map: MapLibreMap;
  playerLocation: PlayerLocation | null;
}) {
  useEffect(() => {
    if (!playerLocation || playerLocation.latitude === null || playerLocation.longitude === null)
      return;

    const element = document.createElement("div");
    element.className = "player-map-marker";
    element.setAttribute("role", "img");
    element.dataset["playerId"] = playerLocation.playerId;
    element.setAttribute(
      "aria-label",
      `Your current location${playerLocation.location ? `: ${playerLocation.location.name}` : ""}`,
    );
    element.title = playerLocation.location
      ? `You are in ${playerLocation.location.name}`
      : "Your current location";

    const pulse = document.createElement("span");
    pulse.className = "player-map-marker-pulse";
    const dot = document.createElement("span");
    dot.className = "player-map-marker-dot";
    element.append(pulse, dot);

    const marker = new Marker({ element, anchor: "center" })
      .setLngLat([playerLocation.longitude, playerLocation.latitude])
      .addTo(map);

    return () => {
      marker.remove();
    };
  }, [playerLocation, map]);

  return null;
}
