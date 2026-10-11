import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AttributionControl,
  FullscreenControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { LocationMarker } from "@/components/game/LocationMarker";
import { MapControls } from "@/components/game/MapControls";
import { PlayerMarker } from "@/components/game/PlayerMarker";
import { PlayerMovementControls } from "@/components/game/PlayerMovementControls";
import { NearbyLocationPrompt } from "@/components/game/NearbyLocationPrompt";
import { useNearbyLocations } from "@/hooks/use-nearby-locations";
import {
  applyOsogboMapPalette,
  createDevelopmentMapFallbackStyle,
  getOsogboMapStyleUrl,
} from "@/lib/osogbo-map-style";
import { q, rpc } from "@/lib/game";
import { resolvePlayerLocation } from "@/lib/player-location";
import {
  OSOGBO_PLAYABLE_BOUNDS,
  publishPlayerMovement,
  stepVirtualPosition,
  type MovementDirection,
} from "@/lib/player-movement";

const OSOGBO_CENTER: [number, number] = [4.556, 7.7677];
setWorkerUrl(mapWorkerUrl);

export type OsogboMapProps = {
  onMapReady?: (map: MapLibreMap) => void;
};

export function OsogboMap({ onMapReady }: OsogboMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const [retryKey, setRetryKey] = useState(0);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [virtualPlayer, setVirtualPlayer] =
    useState<ReturnType<typeof resolvePlayerLocation>>(null);
  const directionsRef = useRef<ReadonlySet<MovementDirection>>(new Set());
  const pendingPositionSaveRef = useRef<{
    location: NonNullable<typeof virtualPlayer>;
    movementStatus: "idle" | "walking";
  } | null>(null);
  const positionSaveInFlightRef = useRef(false);
  const [isMoving, setIsMoving] = useState(false);
  const followPlayerRef = useRef(false);
  const lastSavedAtRef = useRef(0);
  const lastPositionRef = useRef(virtualPlayer);
  lastPositionRef.current = virtualPlayer;
  const { data: character } = useQuery(q.character());
  const { data: currentLocation } = useQuery(
    q.locationById(character?.current_location_id ?? null),
  );
  const playerLocation = useMemo(
    () => resolvePlayerLocation(character, currentLocation ? [currentLocation] : undefined),
    [character, currentLocation],
  );
  const displayedPlayer = virtualPlayer ?? playerLocation;
  const proximityPosition = useMemo(
    () =>
      displayedPlayer?.latitude !== null &&
      displayedPlayer?.latitude !== undefined &&
      displayedPlayer.longitude !== null &&
      displayedPlayer.longitude !== undefined
        ? { latitude: displayedPlayer.latitude, longitude: displayedPlayer.longitude }
        : null,
    [displayedPlayer?.latitude, displayedPlayer?.longitude],
  );
  const { nearbyLocations } = useNearbyLocations(proximityPosition, character?.level ?? 0);
  useEffect(() => {
    if (!playerLocation) {
      setVirtualPlayer(null);
      return;
    }
    setVirtualPlayer((current) =>
      current?.playerId === playerLocation.playerId ? current : playerLocation,
    );
  }, [playerLocation]);

  const handleDirections = useCallback((directions: ReadonlySet<MovementDirection>) => {
    directionsRef.current = directions;
    if (directions.size > 0) setIsMoving(true);
  }, []);

  const savePosition = useCallback(
    (location: NonNullable<typeof virtualPlayer>, movementStatus: "idle" | "walking") => {
      if (location.latitude === null || location.longitude === null) return;
      pendingPositionSaveRef.current = { location, movementStatus };
      if (positionSaveInFlightRef.current) return;
      positionSaveInFlightRef.current = true;
      void (async () => {
        while (pendingPositionSaveRef.current) {
          const pending = pendingPositionSaveRef.current;
          pendingPositionSaveRef.current = null;
          try {
            await rpc.savePlayerMapPosition({
              latitude: pending.location.latitude!,
              longitude: pending.location.longitude!,
              movementState: pending.movementStatus,
            });
            lastSavedAtRef.current = Date.now();
          } catch (error) {
            if (!pendingPositionSaveRef.current) pendingPositionSaveRef.current = pending;
            console.error("Could not save virtual player position", error);
            break;
          }
        }
        positionSaveInFlightRef.current = false;
      })();
    },
    [],
  );

  useEffect(() => {
    if (!mapInstance || !isMoving) return;
    let frame = 0;
    let previousTime = 0;
    let lastPublish = 0;
    const animate = (time: number) => {
      const current = lastPositionRef.current;
      const directions = directionsRef.current;
      if (current && directions.size && current.latitude !== null && current.longitude !== null) {
        const position = stepVirtualPosition(
          { latitude: current.latitude, longitude: current.longitude },
          directions,
          previousTime ? time - previousTime : 16,
        );
        previousTime = time;
        const next = { ...current, ...position, movementStatus: "walking" as const };
        setVirtualPlayer(next);
        lastPositionRef.current = next;
        if (followPlayerRef.current)
          mapInstance?.setCenter([position.longitude, position.latitude]);
        if (time - lastPublish > 80) {
          publishPlayerMovement(position, "walking");
          lastPublish = time;
        }
        if (Date.now() - lastSavedAtRef.current > 3000) {
          lastSavedAtRef.current = Date.now();
          savePosition(next, "walking");
        }
      } else {
        previousTime = 0;
        if (current?.movementStatus === "walking") {
          const stopped = { ...current, movementStatus: "idle" as const };
          setVirtualPlayer(stopped);
          lastPositionRef.current = stopped;
          publishPlayerMovement(
            { latitude: stopped.latitude!, longitude: stopped.longitude! },
            "idle",
          );
          savePosition(stopped, "idle");
        }
        setIsMoving(false);
        return;
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [isMoving, mapInstance, savePosition]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    let didLoad = false;
    let usingDevelopmentFallback = false;
    setLoaded(false);
    setMapError(null);
    setMapInstance(null);

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        center: OSOGBO_CENTER,
        zoom: 13,
        minZoom: 10,
        maxZoom: 19,
        maxBounds: [
          [OSOGBO_PLAYABLE_BOUNDS.west, OSOGBO_PLAYABLE_BOUNDS.south],
          [OSOGBO_PLAYABLE_BOUNDS.east, OSOGBO_PLAYABLE_BOUNDS.north],
        ],
        attributionControl: false,
        style: getOsogboMapStyleUrl(),
        cooperativeGestures: true,
      });
    } catch {
      setMapError("The Osogbo map could not start.");
      return;
    }

    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new FullscreenControl(), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    const loadTimer = window.setTimeout(() => {
      if (!didLoad)
        setMapError("The map is taking too long to load. Check your connection and retry.");
    }, 20_000);
    map.once("load", () => {
      didLoad = true;
      if (loadTimer) window.clearTimeout(loadTimer);
      setLoaded(true);
      setMapError(null);
      setMapInstance(map);
      onMapReadyRef.current?.(map);
    });
    const handleStyleLoad = () => applyOsogboMapPalette(map);
    map.on("style.load", handleStyleLoad);
    const handleMapError = () => {
      if (!didLoad && !map.isStyleLoaded()) {
        if (import.meta.env.DEV && !usingDevelopmentFallback) {
          usingDevelopmentFallback = true;
          map.setStyle(createDevelopmentMapFallbackStyle());
          return;
        }
        setMapError(
          "Map data could not be loaded. Check your map provider configuration and retry.",
        );
      }
    };
    map.on("error", handleMapError);
    const updateCameraMetadata = () => {
      const center = map.getCenter();
      container.dataset["mapCenter"] = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
      container.dataset["mapZoom"] = map.getZoom().toFixed(2);
    };
    map.on("moveend", updateCameraMetadata);
    map.on("zoomend", updateCameraMetadata);
    updateCameraMetadata();
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.off("moveend", updateCameraMetadata);
      map.off("zoomend", updateCameraMetadata);
      map.off("error", handleMapError);
      map.off("style.load", handleStyleLoad);
      if (loadTimer) window.clearTimeout(loadTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [retryKey]);

  return (
    <div className="osogbo-map-frame">
      <div
        ref={containerRef}
        className="osogbo-map-canvas"
        role="application"
        aria-label="Interactive OpenStreetMap map centered on Osogbo, Osun State, Nigeria"
        data-map-center={`${OSOGBO_CENTER[1]},${OSOGBO_CENTER[0]}`}
      />
      {mapInstance && <LocationMarker map={mapInstance} />}
      {mapInstance && <PlayerMarker map={mapInstance} playerLocation={displayedPlayer} />}
      {mapInstance && <MapControls map={mapInstance} playerLocation={displayedPlayer} />}
      {mapInstance && (
        <PlayerMovementControls
          onDirectionChange={handleDirections}
          onFollowChange={(enabled) => {
            followPlayerRef.current = enabled;
            if (
              enabled &&
              displayedPlayer &&
              displayedPlayer.latitude !== null &&
              displayedPlayer.longitude !== null
            ) {
              mapInstance.setCenter([displayedPlayer.longitude, displayedPlayer.latitude]);
            }
          }}
        />
      )}
      {mapInstance && <NearbyLocationPrompt nearbyLocations={nearbyLocations} />}
      {!loaded && !mapError && (
        <div className="osogbo-map-loading" aria-live="polite">
          Loading Osogbo map…
        </div>
      )}
      {mapError && (
        <div className="osogbo-map-error" role="alert">
          <span>{mapError}</span>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
            Retry map
          </button>
        </div>
      )}
      <div className="osogbo-map-place-label" aria-live="polite">
        <span className="osogbo-map-live-dot" />
        <span>
          {displayedPlayer?.location
            ? `PLAYER POSITION · ${displayedPlayer.location.name.toUpperCase()}`
            : displayedPlayer?.currentLocationId
              ? "PLAYER POSITION · OSOGBO"
              : "OSOGBO, OSUN STATE"}
        </span>
      </div>
    </div>
  );
}
