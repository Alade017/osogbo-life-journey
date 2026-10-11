import { useEffect, useRef } from "react";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { PlayerLocation } from "@/lib/player-location";

export function PlayerMarker({
  map,
  playerLocation,
}: {
  map: MapLibreMap;
  playerLocation: PlayerLocation | null;
}) {
  const markerRef = useRef<Marker | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = document.createElement("div");
    element.className = "player-map-marker";
    element.setAttribute("role", "img");
    element.style.display = "none";

    const pulse = document.createElement("span");
    pulse.className = "player-map-marker-pulse";
    const dot = document.createElement("span");
    dot.className = "player-map-marker-dot";
    element.append(pulse, dot);

    const marker = new Marker({ element, anchor: "center" }).setLngLat([4.556, 7.7677]).addTo(map);
    markerRef.current = marker;
    elementRef.current = element;

    return () => {
      marker.remove();
      markerRef.current = null;
      elementRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!playerLocation || playerLocation.latitude === null || playerLocation.longitude === null)
      return;
    markerRef.current?.setLngLat([playerLocation.longitude, playerLocation.latitude]);
    const element = elementRef.current;
    if (element) {
      element.style.display = "grid";
      element.dataset["playerId"] = playerLocation.playerId;
      element.dataset["movementState"] = playerLocation.movementStatus;
      element.setAttribute(
        "aria-label",
        `Your current position${playerLocation.location ? `: ${playerLocation.location.name}` : ""}${playerLocation.movementStatus === "walking" ? ", moving" : ""}`,
      );
      element.title = playerLocation.location
        ? `You are in ${playerLocation.location.name}`
        : "Your current position";
    }
  }, [playerLocation]);

  return null;
}
