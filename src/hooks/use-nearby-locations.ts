import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { q } from "@/lib/game";
import {
  findNearbyLocations,
  NearbyLocationTracker,
  proximityQueryBounds,
  publishNearbyLocationTransition,
  type NearbyLocation,
} from "@/lib/nearby-location-service";
import type { VirtualPosition } from "@/lib/player-movement";
import { subscribePlayerMovement } from "@/lib/player-movement";

export function useNearbyLocations(initialPosition: VirtualPosition | null, playerLevel = 0) {
  const [position, setPosition] = useState(initialPosition);
  const trackerRef = useRef(new NearbyLocationTracker());
  const [nearbyLocations, setNearbyLocations] = useState<NearbyLocation[]>([]);
  const initialLatitude = initialPosition?.latitude;
  const initialLongitude = initialPosition?.longitude;

  useEffect(() => {
    setPosition(
      initialLatitude !== undefined && initialLongitude !== undefined
        ? { latitude: initialLatitude, longitude: initialLongitude }
        : null,
    );
  }, [initialLatitude, initialLongitude]);

  useEffect(
    () =>
      subscribePlayerMovement((event) => {
        setPosition(event.position);
      }),
    [],
  );

  const playerLatitude = position?.latitude;
  const playerLongitude = position?.longitude;
  const bounds = useMemo(
    () =>
      playerLatitude !== undefined && playerLongitude !== undefined
        ? proximityQueryBounds(playerLatitude, playerLongitude)
        : proximityQueryBounds(7.7677, 4.556),
    [playerLatitude, playerLongitude],
  );
  const locationsQuery = q.mapLocations(bounds);
  const {
    data: locations,
    isError,
    isLoading,
  } = useQuery({
    ...locationsQuery,
    enabled: position !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (playerLatitude === undefined || playerLongitude === undefined || !locations) return;
    const nextNearby = findNearbyLocations(
      { latitude: playerLatitude, longitude: playerLongitude },
      locations,
      playerLevel,
    );
    trackerRef.current.update(nextNearby).forEach(publishNearbyLocationTransition);
    setNearbyLocations(nextNearby);
  }, [locations, playerLevel, playerLatitude, playerLongitude]);

  return { nearbyLocations, closestLocation: nearbyLocations[0] ?? null, isError, isLoading };
}
