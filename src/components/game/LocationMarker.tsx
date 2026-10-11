import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Popup,
  type ExpressionSpecification,
} from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import type { MapLocationBounds } from "@/lib/game";
import { q } from "@/lib/game";
import type { MappableLocation } from "@/lib/location-map-model";
import { hasValidCoordinates, locationsToFeatureCollection } from "@/lib/location-map-model";
import { LocationPopup } from "@/components/game/LocationPopup";
import {
  LOCATION_CATEGORIES,
  getLocationCategory,
  getLocationNeighborhood,
  locationCategoryColour,
  LOCATION_MARKER_GLYPHS,
} from "@/lib/location-service";

const SOURCE_ID = "game-locations";
const LAYER_ID = "game-location-markers";

function boundsForMap(map: MapLibreMap): MapLocationBounds {
  const bounds = map.getBounds();
  const rounded = (value: number) => Math.round(value * 1000) / 1000;
  return {
    north: rounded(bounds.getNorth()),
    south: rounded(bounds.getSouth()),
    east: rounded(bounds.getEast()),
    west: rounded(bounds.getWest()),
  };
}

function markerImage(map: MapLibreMap, category: string) {
  const imageId = `location-marker-${category}`;
  if (map.hasImage(imageId)) return imageId;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.beginPath();
  context.arc(32, 32, 28, 0, Math.PI * 2);
  context.fillStyle = locationCategoryColour(category);
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "#fff";
  context.stroke();
  context.fillStyle = "#fff";
  context.font = "700 27px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    LOCATION_MARKER_GLYPHS[category as keyof typeof LOCATION_MARKER_GLYPHS] ?? "•",
    32,
    33,
  );
  map.addImage(imageId, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
  return imageId;
}

export function LocationMarker({ map }: { map: MapLibreMap }) {
  const openLocationRef = useRef<(location: MappableLocation) => void>(() => {});
  const [bounds, setBounds] = useState(() => boundsForMap(map));
  const {
    data: activeLocations,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(q.mapLocations(bounds));
  const locations = useMemo<MappableLocation[]>(
    () => (activeLocations ?? []).filter(hasValidCoordinates),
    [activeLocations],
  );
  const [visibleTypes, setVisibleTypes] = useState<Set<string> | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const neighborhoods = useMemo(
    () =>
      [
        ...new Set(
          locations.map(getLocationNeighborhood).filter((value): value is string => !!value),
        ),
      ].sort(),
    [locations],
  );
  const locationTypes = useMemo(
    () => [...new Set(locations.map(getLocationCategory))].sort(),
    [locations],
  );
  const visibleLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          (!visibleTypes || visibleTypes.has(getLocationCategory(location))) &&
          (!selectedNeighborhood || getLocationNeighborhood(location) === selectedNeighborhood),
      ),
    [locations, selectedNeighborhood, visibleTypes],
  );
  const featureCollection = useMemo(
    () => locationsToFeatureCollection(visibleLocations),
    [visibleLocations],
  );
  const skippedCount = Math.max(0, (activeLocations?.length ?? 0) - locations.length);

  useEffect(() => {
    const updateBounds = () => {
      const next = boundsForMap(map);
      setBounds((previous) =>
        previous.north === next.north &&
        previous.south === next.south &&
        previous.east === next.east &&
        previous.west === next.west
          ? previous
          : next,
      );
    };
    map.on("moveend", updateBounds);
    map.on("zoomend", updateBounds);
    return () => {
      map.off("moveend", updateBounds);
      map.off("zoomend", updateBounds);
    };
  }, [map]);

  useEffect(() => {
    if (!map.isStyleLoaded()) return;

    for (const category of locationTypes) markerImage(map, category);

    const existingSource = map.getSource(SOURCE_ID);
    if (existingSource?.type === "geojson") {
      (existingSource as GeoJSONSource).setData(featureCollection);
    } else {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: featureCollection,
        promoteId: "id",
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 44,
      });
    }

    if (!map.getLayer(`${LAYER_ID}-clusters`)) {
      map.addLayer({
        id: `${LAYER_ID}-clusters`,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#344b68",
          "circle-radius": ["step", ["get", "point_count"], 16, 25, 21, 100, 27],
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 2,
        },
      });
    }

    if (!map.getLayer(`${LAYER_ID}-cluster-count`)) {
      map.addLayer({
        id: `${LAYER_ID}-cluster-count`,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Stadia Semibold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
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
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            13,
            ["boolean", ["feature-state", "hovered"], false],
            10,
            ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 8, 19, 12],
          ],
          "circle-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#eea43a",
            ["boolean", ["feature-state", "hovered"], false],
            "#e59a31",
            colorExpression,
          ],
          "circle-stroke-color": "#fff9e9",
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            4,
            ["boolean", ["feature-state", "hovered"], false],
            3,
            2,
          ],
          "circle-opacity": 0.96,
          "circle-stroke-opacity": 0.98,
        },
      });
    }

    if (!map.getLayer(`${LAYER_ID}-icons`)) {
      map.addLayer({
        id: `${LAYER_ID}-icons`,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "markerImage"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.65, 15, 0.9, 19, 1.05],
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
        },
      });
    }

    if (!map.getLayer(`${LAYER_ID}-labels`)) {
      map.addLayer({
        id: `${LAYER_ID}-labels`,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        minzoom: 12,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Stadia Semibold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 16, 12],
          "text-variable-anchor": ["top", "bottom", "left", "right"],
          "text-radial-offset": 0.85,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#263c55",
          "text-halo-color": "#fffdf8",
          "text-halo-width": 1.2,
        },
      });
    }

    const popupRoots = new Set<Root>();
    let activePopup: Popup | undefined;
    let selectedFeatureId: string | number | null = null;
    let hoveredFeatureId: string | number | null = null;
    const closePopup = () => {
      activePopup?.remove();
      activePopup = undefined;
      for (const root of popupRoots) root.unmount();
      popupRoots.clear();
    };
    const openLocation = (location: MappableLocation) => {
      if (selectedFeatureId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
      }
      selectedFeatureId = location.id;
      map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: true });

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
        if (selectedFeatureId === location.id) {
          map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
          selectedFeatureId = null;
        }
        root.unmount();
        popupRoots.delete(root);
        if (activePopup === popup) activePopup = undefined;
      });
    };
    openLocationRef.current = openLocation;

    const onMarkerClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (feature?.properties && "point_count" in feature.properties) {
        const clusterId = feature.properties["cluster_id"];
        const source = map.getSource(SOURCE_ID);
        if (typeof clusterId === "number" && source?.type === "geojson") {
          void (source as GeoJSONSource)
            .getClusterExpansionZoom(clusterId)
            .then((zoom) => map.easeTo({ center: event.lngLat, zoom }));
        }
        return;
      }
      const id = event.features?.[0]?.properties?.["id"];
      const location = visibleLocations.find((candidate) => candidate.id === id);
      if (!location || !hasValidCoordinates(location)) return;
      openLocation(location);
    };
    const onMouseEnter = (event: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const id = event.features?.[0]?.id;
      if (id !== undefined && id !== null && typeof id !== "string" && typeof id !== "number")
        return;
      if (
        id !== undefined &&
        id !== null &&
        !("point_count" in (event.features?.[0]?.properties ?? {}))
      ) {
        hoveredFeatureId = id;
        map.setFeatureState({ source: SOURCE_ID, id }, { hovered: true });
      }
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hovered: false });
        hoveredFeatureId = null;
      }
    };

    const markerLayers = [
      `${LAYER_ID}-clusters`,
      `${LAYER_ID}-cluster-count`,
      LAYER_ID,
      `${LAYER_ID}-icons`,
      `${LAYER_ID}-labels`,
    ];
    for (const layer of markerLayers) {
      map.on("click", layer, onMarkerClick);
      map.on("mouseenter", layer, onMouseEnter);
      map.on("mouseleave", layer, onMouseLeave);
    }

    return () => {
      for (const layer of markerLayers) {
        map.off("click", layer, onMarkerClick);
        map.off("mouseenter", layer, onMouseEnter);
        map.off("mouseleave", layer, onMouseLeave);
      }
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hovered: false });
      }
      closePopup();
    };
  }, [featureCollection, visibleLocations, locationTypes, map]);

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
        <strong>No mapped locations in this view</strong>
        <span>
          Active locations with valid coordinates in this part of Osogbo will appear here.
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
        {neighborhoods.length > 0 && (
          <label className="location-map-neighborhood-filter">
            <span>Neighborhood</span>
            <select
              aria-label="Filter locations by neighborhood"
              value={selectedNeighborhood ?? "all"}
              onChange={(event) =>
                setSelectedNeighborhood(
                  event.currentTarget.value === "all" ? null : event.currentTarget.value,
                )
              }
            >
              <option value="all">All neighborhoods</option>
              {neighborhoods.map((neighborhood) => (
                <option key={neighborhood} value={neighborhood}>
                  {neighborhood}
                </option>
              ))}
            </select>
          </label>
        )}
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
      <details className="location-map-keyboard-browse">
        <summary>Browse locations ({visibleLocations.length})</summary>
        <div className="location-map-keyboard-list" aria-label="Locations in this map view">
          {visibleLocations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => {
                map.easeTo({ center: [location.longitude, location.latitude], zoom: 16 });
                openLocationRef.current(location);
              }}
            >
              <span aria-hidden="true">
                {LOCATION_MARKER_GLYPHS[
                  getLocationCategory(location) as keyof typeof LOCATION_MARKER_GLYPHS
                ] ?? "•"}
              </span>
              <span>{location.name}</span>
              <small>{LOCATION_CATEGORIES[getLocationCategory(location)].label}</small>
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
