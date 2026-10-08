import { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeatureCollection, Point } from "geojson";
import {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Popup,
  type ExpressionSpecification,
} from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import type { CityLocationData } from "@/lib/location-service";
import { LocationPopup } from "@/components/game/LocationPopup";
import {
  LOCATION_CATEGORIES,
  getLocationCategory,
  locationCategoryColour,
} from "@/lib/location-service";

const SOURCE_ID = "game-locations";
const LAYER_ID = "game-location-markers";

type LocationFeatureProperties = {
  id: string;
  name: string;
  category: string;
};

export function hasValidCoordinates(location: CityLocationData): location is CityLocationData & {
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
  const [visibleTypes, setVisibleTypes] = useState<Set<string> | null>(null);
  const locationTypes = useMemo(
    () => [...new Set(locations.map(getLocationCategory))].sort(),
    [locations],
  );
  const visibleLocations = useMemo(
    () =>
      locations.filter(
        (location) => !visibleTypes || visibleTypes.has(getLocationCategory(location)),
      ),
    [locations, visibleTypes],
  );
  const skippedCount = (activeLocations?.length ?? 0) - locations.length;
  const featureCollection = useMemo<FeatureCollection<Point, LocationFeatureProperties>>(
    () => ({
      type: "FeatureCollection",
      features: visibleLocations.map((location) => ({
        type: "Feature",
        id: location.id,
        geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        properties: {
          id: location.id,
          name: location.name,
          category: getLocationCategory(location),
        },
      })),
    }),
    [visibleLocations],
  );

  useEffect(() => {
    if (!map.isStyleLoaded()) return;

    const existingSource = map.getSource(SOURCE_ID);
    if (existingSource?.type === "geojson") {
      (existingSource as GeoJSONSource).setData(featureCollection);
    } else {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: featureCollection,
        promoteId: "id",
      });
    }

    if (!map.getLayer(LAYER_ID)) {
      const colorExpression = [
        "match",
        ["get", "category"],
        ...Object.entries(LOCATION_CATEGORIES).flatMap(([category, definition]) => [
          category,
          definition.colour,
        ]),
        locationCategoryColour("other"),
      ] as unknown as ExpressionSpecification;

      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": colorExpression,
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
      const id = event.features?.[0]?.properties?.["id"];
      const location = visibleLocations.find((candidate) => candidate.id === id);
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
  }, [featureCollection, visibleLocations, map]);

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
        <strong>
          {activeLocations?.length ? "City pins need coordinates" : "No active city pins yet"}
        </strong>
        <span>
          {activeLocations?.length
            ? "These locations are saved, but verified map coordinates have not been added yet."
            : "Active locations will appear here when they are added to the city."}
          {skippedCount > 0 &&
            ` ${skippedCount} active record(s) currently lack valid coordinates.`}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="location-map-legend" aria-label="Mapped locations by type">
        <span className="location-map-count">
          {visibleLocations.length} of {locations.length} mapped
        </span>
        {skippedCount > 0 && <span>{skippedCount} skipped: missing/invalid coordinates</span>}
        {locationTypes.map((category) => {
          const checked = !visibleTypes || visibleTypes.has(category);
          return (
            <button
              key={category}
              type="button"
              className="location-map-filter"
              aria-pressed={checked}
              onClick={() =>
                setVisibleTypes((previous) => {
                  const next = new Set(previous ?? locationTypes);
                  if (next.has(category)) next.delete(category);
                  else next.add(category);
                  return next.size === locationTypes.length ? null : next;
                })
              }
            >
              <span
                className="location-map-legend-dot"
                style={{ background: locationCategoryColour(category) }}
              />
              {LOCATION_CATEGORIES[category].label}
            </button>
          );
        })}
      </div>
    </>
  );
}
