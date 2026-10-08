import { useEffect, useRef, useState } from "react";
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
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;

    const map = new MapLibreMap({
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

    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new FullscreenControl(), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.once("load", () => {
      setLoaded(true);
      setMapInstance(map);
      onMapReadyRef.current?.(map);
    });
    const updateCameraMetadata = () => {
      const center = map.getCenter();
      container.dataset.mapCenter = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
      container.dataset.mapZoom = map.getZoom().toFixed(2);
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
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      {!loaded && (
        <div className="osogbo-map-loading" aria-live="polite">
          Loading Osogbo map…
        </div>
      )}
      <div className="osogbo-map-place-label" aria-hidden="true">
        <span className="osogbo-map-live-dot" />
        <span>OSOGBO, OSUN STATE</span>
      </div>
    </div>
  );
}
