import { useEffect, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeatureCollection, Point } from "geojson";
import { Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import { q, type MapLocation } from "@/lib/game";
import { LocationPopup } from "@/components/game/LocationPopup";
import { LOCATION_TYPE_COLOURS, locationTypeColour } from "@/lib/location-service";

const SOURCE_ID = "game-locations";
const LAYER_ID = "game-location-markers";

type LocationFeatureProperties = {
  id: string;
  name: string;
  type: string;
};

function hasValidCoordinates(location: MapLocation): location is MapLocation & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export function LocationMarker({ map }: { map: MapLibreMap }) {
  const { data: activeLocations, isLoading, isError, error, refetch } = useQuery(q.mapLocations());
  const locations = useMemo(
    () => (activeLocations ?? []).filter(hasValidCoordinates),
    [activeLocations],
  );
  const skippedCount = (activeLocations?.length ?? 0) - locations.length;
  const featureCollection = useMemo<FeatureCollection<Point, LocationFeatureProperties>>(
    () => ({
      type: "FeatureCollection",
      features: locations.map((location) => ({
        type: "Feature",
        id: location.id,
        geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        properties: {
          id: location.id,
          name: location.name,
          type: location.type,
        },
      })),
    }),
    [locations],
  );

  useEffect(() => {
    if (!map.isStyleLoaded()) return;

    const existingSource = map.getSource(SOURCE_ID);
    if (existingSource?.type === "geojson") {
      existingSource.setData(featureCollection);
    } else {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: featureCollection,
        promoteId: "id",
      });
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            ...Object.entries(LOCATION_TYPE_COLOURS).flat(),
            locationTypeColour("custom"),
          ],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 8, 19, 12],
          "circle-stroke-color": "#fff9e9",
          "circle-stroke-width": 2,
          "circle-opacity": 0.96,
          "circle-stroke-opacity": 0.98,
        },
      });
    }

    const popupRoots = new Set<Root>();
    let activePopup: Popup | undefined;
    const closePopup = () => {
      activePopup?.remove();
      activePopup = undefined;
      for (const root of popupRoots) root.unmount();
      popupRoots.clear();
    };
    const onMarkerClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      const location = locations.find((candidate) => candidate.id === id);
      if (!location || !hasValidCoordinates(location)) return;

      activePopup?.remove();
      const popupNode = document.createElement("div");
      const root = createRoot(popupNode);
      root.render(<LocationPopup location={location} />);
      popupRoots.add(root);

      const popup = new Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: "310px",
        offset: 13,
      })
        .setLngLat([location.longitude, location.latitude])
        .setDOMContent(popupNode)
        .addTo(map);
      activePopup = popup;
      popup.on("close", () => {
        root.unmount();
        popupRoots.delete(root);
        if (activePopup === popup) activePopup = undefined;
      });
    };
    const onMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", LAYER_ID, onMarkerClick);
    map.on("mouseenter", LAYER_ID, onMouseEnter);
    map.on("mouseleave", LAYER_ID, onMouseLeave);

    return () => {
      map.off("click", LAYER_ID, onMarkerClick);
      map.off("mouseenter", LAYER_ID, onMouseEnter);
      map.off("mouseleave", LAYER_ID, onMouseLeave);
      closePopup();
    };
  }, [featureCollection, locations, map]);

  if (isLoading) {
    return (
      <div className="location-map-status" role="status">
        Loading mapped locations…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="location-map-status location-map-status-error" role="alert">
        <span>Locations could not be loaded: {error.message}</span>
        <button type="button" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="location-map-status" role="status">
        <strong>No mapped locations yet</strong>
        <span>
          Active locations will appear here when verified coordinates are added.
          {skippedCount > 0 &&
            ` ${skippedCount} active record(s) currently lack valid coordinates.`}
        </span>
      </div>
    );
  }

  return (
    <div className="location-map-legend" aria-label="Mapped locations by type">
      <span className="location-map-count">{locations.length} mapped location(s)</span>
      {skippedCount > 0 && <span>{skippedCount} skipped: missing/invalid coordinates</span>}
      <span
        className="location-map-legend-dot"
        style={{ background: locationTypeColour("market") }}
      />
      <span>Market</span>
      <span
        className="location-map-legend-dot"
        style={{ background: locationTypeColour("government") }}
      />
      <span>Government</span>
      <span
        className="location-map-legend-dot"
        style={{ background: locationTypeColour("custom") }}
      />
      <span>Other</span>
    </div>
  );
}
