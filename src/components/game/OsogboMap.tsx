import { useEffect, useMemo, useRef, useState } from "react";
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
import { q } from "@/lib/game";
import { resolvePlayerLocation } from "@/lib/player-location";

const OSOGBO_CENTER: [number, number] = [4.556, 7.7677];
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

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
  const { data: locations } = useQuery(q.mapLocations());
  const { data: character } = useQuery(q.character());
  const playerLocation = useMemo(
    () => resolvePlayerLocation(character, locations),
    [character, locations],
  );

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    let didLoad = false;
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
          [4.25, 7.48],
          [4.88, 8.02],
        ],
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: OSM_ATTRIBUTION,
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: "osm-raster",
              type: "raster",
              source: "osm",
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
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
    const handleMapError = () => {
      if (!didLoad && !map.isStyleLoaded()) {
        setMapError("Map data could not be loaded. Check your connection and retry.");
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
      {mapInstance && <PlayerMarker map={mapInstance} playerLocation={playerLocation} />}
      {mapInstance && <MapControls map={mapInstance} playerLocation={playerLocation} />}
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
          {playerLocation?.location
            ? `YOU ARE IN ${playerLocation.location.name.toUpperCase()}`
            : playerLocation?.currentLocationId
              ? "YOUR DISTRICT NEEDS MAP COORDINATES"
              : "OSOGBO, OSUN STATE"}
        </span>
      </div>
    </div>
  );
}
