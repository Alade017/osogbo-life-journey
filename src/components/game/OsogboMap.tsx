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
import { OsogboMapSvg } from "@/components/map/OsogboMap.svg";
import { MapSceneSkeleton } from "@/components/game/loading-skeletons";
import { useNearbyLocations } from "@/hooks/use-nearby-locations";
import {
  isBaseSourceReady,
  isCriticalMapError,
  isWebGlAvailable,
  preflightMapStyle,
} from "@/lib/map-load-health";
import { applyOsogboMapPalette, getOsogboMapStyleUrls } from "@/lib/osogbo-map-style";
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
  onSelectDistrict?: (id: string) => void;
  onSelectLandmark?: (id: string) => void;
};

export function OsogboMap({ onMapReady, onSelectDistrict, onSelectLandmark }: OsogboMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const [retryKey, setRetryKey] = useState(0);
  const [providerIndex, setProviderIndex] = useState(0);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [surface, setSurface] = useState<"loading" | "street" | "fallback">("loading");
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
    const styleUrls = getOsogboMapStyleUrls();
    const styleUrl = styleUrls[providerIndex];
    let active = true;
    let usable = false;
    let sourceReady = false;
    let loadTimer = 0;
    const abortController = new AbortController();
    setSurface("loading");
    setMapInstance(null);

    const showNextProviderOrFallback = () => {
      if (!active) return;
      abortController.abort();
      if (loadTimer) window.clearTimeout(loadTimer);
      if (providerIndex + 1 < styleUrls.length) setProviderIndex(providerIndex + 1);
      else setSurface("fallback");
    };

    let resizeObserver: ResizeObserver | null = null;
    let handleStyleLoad: (() => void) | null = null;
    let handleMapError: ((event: unknown) => void) | null = null;
    let handleSourceData: ((event: unknown) => void) | null = null;
    let handleIdle: (() => void) | null = null;
    let updateCameraMetadata: (() => void) | null = null;

    const start = async () => {
      if (!styleUrl || !isWebGlAvailable()) {
        setSurface("fallback");
        return;
      }

      loadTimer = window.setTimeout(showNextProviderOrFallback, 15_000);
      const preflight = await preflightMapStyle(styleUrl, { signal: abortController.signal });
      if (!active) return;
      if (!preflight.ok) {
        showNextProviderOrFallback();
        return;
      }

      const baseSourceIds = new Set(preflight.sourceIds);
      sourceReady = baseSourceIds.size === 0;
      let map: MapLibreMap;
      try {
        map = new MapLibreMap({
          container,
          center: OSOGBO_CENTER,
          zoom: 12.8,
          pitch: 0,
          bearing: 0,
          minZoom: 10,
          maxZoom: 19,
          maxPitch: 0,
          maxBounds: [
            [OSOGBO_PLAYABLE_BOUNDS.west, OSOGBO_PLAYABLE_BOUNDS.south],
            [OSOGBO_PLAYABLE_BOUNDS.east, OSOGBO_PLAYABLE_BOUNDS.north],
          ],
          attributionControl: false,
          style: styleUrl,
          cooperativeGestures: true,
        });
      } catch {
        showNextProviderOrFallback();
        return;
      }

      mapRef.current = map;
      map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new FullscreenControl(), "top-right");
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");

      const markUsable = () => {
        if (!active || usable || !map.isStyleLoaded() || !sourceReady) return;
        usable = true;
        if (loadTimer) window.clearTimeout(loadTimer);
        setSurface("street");
        setMapInstance(map);
        onMapReadyRef.current?.(map);
      };
      handleStyleLoad = () => applyOsogboMapPalette(map);
      handleSourceData = (event) => {
        if (isBaseSourceReady(event, baseSourceIds)) sourceReady = true;
      };
      handleIdle = markUsable;
      handleMapError = (event) => {
        if (isCriticalMapError(event, { usable, baseSourceIds })) {
          showNextProviderOrFallback();
        }
      };
      map.on("style.load", handleStyleLoad);
      map.on("sourcedata", handleSourceData);
      map.on("idle", handleIdle);
      map.on("error", handleMapError);
      map.once("load", markUsable);

      updateCameraMetadata = () => {
        const center = map.getCenter();
        container.dataset["mapCenter"] = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
        container.dataset["mapZoom"] = map.getZoom().toFixed(2);
      };
      map.on("moveend", updateCameraMetadata);
      map.on("zoomend", updateCameraMetadata);
      updateCameraMetadata();
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
    };
    void start();

    return () => {
      active = false;
      abortController.abort();
      resizeObserver?.disconnect();
      const map = mapRef.current;
      if (map && updateCameraMetadata) {
        map.off("moveend", updateCameraMetadata);
        map.off("zoomend", updateCameraMetadata);
      }
      if (map && handleMapError) map.off("error", handleMapError);
      if (map && handleStyleLoad) map.off("style.load", handleStyleLoad);
      if (map && handleSourceData) map.off("sourcedata", handleSourceData);
      if (map && handleIdle) map.off("idle", handleIdle);
      if (loadTimer) window.clearTimeout(loadTimer);
      map?.remove();
      mapRef.current = null;
    };
  }, [providerIndex, retryKey]);

  const retryMap = () => {
    setProviderIndex(0);
    setRetryKey((value) => value + 1);
  };

  return (
    <div className="osogbo-map-frame">
      <div
        ref={containerRef}
        className={`osogbo-map-canvas${surface === "fallback" ? " is-hidden" : ""}`}
        role="application"
        aria-label="Interactive OpenStreetMap map centered on Osogbo, Osun State, Nigeria"
        data-map-center={`${OSOGBO_CENTER[1]},${OSOGBO_CENTER[0]}`}
      />
      {surface === "fallback" && (
        <div className="osogbo-map-fallback">
          <OsogboMapSvg
            labelsVisible
            showLandmarks
            onDistrictSelect={(district) => onSelectDistrict?.(district.id)}
            onLandmarkSelect={(landmark) => onSelectLandmark?.(landmark.id)}
          />
          <div className="osogbo-map-fallback-notice" role="status" aria-live="polite">
            <span>Street map unavailable on this connection. Showing the simplified map.</span>
            <button type="button" onClick={retryMap}>
              Retry street map
            </button>
          </div>
        </div>
      )}
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
      {surface === "loading" && (
        <div className="osogbo-map-loading" aria-live="polite">
          <MapSceneSkeleton />
        </div>
      )}
      <div className="osogbo-map-place-label" aria-live="polite">
        <span className="osogbo-map-live-dot" />
        <span>
          {displayedPlayer?.location
            ? `PLAYER · ${displayedPlayer.location.name.toUpperCase()}`
            : displayedPlayer?.currentLocationId
              ? "PLAYER POSITION · OSOGBO"
              : "OSOGBO, OSUN STATE"}
        </span>
        <small>
          Real streets &amp; terrain · fictional venues · gold dots are orientation only
        </small>
      </div>
    </div>
  );
}
