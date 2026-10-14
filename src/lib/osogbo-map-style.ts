import type { FilterSpecification, Map as MapLibreMap } from "maplibre-gl";

const DEFAULT_VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const HILLSHADE_URL =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const ORIENTATION_LANDMARKS = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      id: "olaiya-roundabout",
      geometry: { type: "Point" as const, coordinates: [4.556, 7.7677] },
      properties: { name: "Olaiya Roundabout" },
    },
    {
      type: "Feature" as const,
      id: "mandela-freedom-park",
      geometry: { type: "Point" as const, coordinates: [4.545888, 7.778321] },
      properties: { name: "Nelson Mandela Freedom Park" },
    },
  ],
};

export function getOsogboMapStyleUrl(): string {
  const styleUrl = import.meta.env["VITE_OSOGBO_MAP_STYLE_URL"] || DEFAULT_VECTOR_STYLE;
  const apiKey = import.meta.env["VITE_STADIA_MAPS_API_KEY"];
  if (!apiKey || !styleUrl.startsWith("https://tiles.stadiamaps.com/")) return styleUrl;

  const url = new URL(styleUrl);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export function shouldHideBaseMapLayer(id: string, sourceLayer = "") {
  return /building|poi|housenumber|address/i.test(`${id} ${sourceLayer}`);
}

export function isExcludedBaseMapLabel(name: string) {
  return /sacred|grove|shrine|mosque|church|chapel|temple/i.test(name);
}

/** Keep the basemap geographic: roads, water, land cover, place names, and terrain only. */
export function applyOsogboMapPalette(map: MapLibreMap) {
  if (!map.isStyleLoaded()) return;
  const layers = map.getStyle().layers;

  for (const layer of layers) {
    const spec = layer as typeof layer & { "source-layer"?: string };
    const sourceLayer = spec["source-layer"]?.toLowerCase() ?? "";
    const id = layer.id.toLowerCase();

    if (shouldHideBaseMapLayer(id, sourceLayer)) {
      if (layer.type !== "background") map.setLayoutProperty(layer.id, "visibility", "none");
      continue;
    }

    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", "#f2f6ed");
      continue;
    }

    if (layer.type === "fill" && (sourceLayer === "water" || id.includes("water"))) {
      map.setPaintProperty(layer.id, "fill-color", "#cde1e7");
      map.setPaintProperty(layer.id, "fill-opacity", 0.95);
    } else if (
      layer.type === "fill" &&
      (sourceLayer === "park" || id.includes("park") || id.includes("wood"))
    ) {
      map.setPaintProperty(layer.id, "fill-color", "#d8e8d0");
    } else if (layer.type === "fill" && (sourceLayer === "building" || id.includes("building"))) {
      map.setPaintProperty(layer.id, "fill-color", "#ffffff");
      map.setPaintProperty(layer.id, "fill-outline-color", "#d5e1d0");
    } else if (layer.type === "line" && sourceLayer === "transportation") {
      map.setPaintProperty(layer.id, "line-color", [
        "match",
        ["get", "class"],
        ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"],
        "#e6c676",
        ["secondary", "secondary_link", "tertiary", "tertiary_link"],
        "#e7efdf",
        ["rail", "transit", "ferry"],
        "#9eaf9f",
        "#ffffff",
      ]);
    } else if (layer.type === "line" && sourceLayer === "waterway") {
      map.setPaintProperty(layer.id, "line-color", "#b7d7df");
    } else if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      const labelText = layer.layout["text-field"];
      if (typeof labelText === "string" && isExcludedBaseMapLabel(labelText)) {
        map.setLayoutProperty(layer.id, "visibility", "none");
        continue;
      }
      const existingFilter = layer.filter;
      const safeName = ["downcase", ["to-string", ["coalesce", ["get", "name"], ""]]];
      const excludedNames = ["sacred", "grove", "shrine", "mosque", "church", "chapel", "temple"];
      const safeLabelFilter = [
        "all",
        ...(existingFilter ? [existingFilter] : []),
        ["!", ["any", ...excludedNames.map((name) => [">=", ["index-of", name, safeName], 0])]],
      ] as unknown as FilterSpecification;
      map.setFilter(layer.id, safeLabelFilter);
      map.setPaintProperty(layer.id, "text-color", "#173d2b");
      map.setPaintProperty(layer.id, "text-halo-color", "#f2f6ed");
      map.setPaintProperty(layer.id, "text-halo-width", 1.1);
    }
  }

  const hillshadeSourceId = "osogbo-elevation-hillshade";
  const hillshadeLayerId = "osogbo-elevation-context";
  if (!map.getSource(hillshadeSourceId)) {
    map.addSource(hillshadeSourceId, {
      type: "raster",
      tiles: [HILLSHADE_URL],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        'Elevation relief © <a href="https://www.esri.com/en-us/legal/terms/full-master-agreement" target="_blank" rel="noreferrer">Esri and data providers</a>',
    });
  }
  if (!map.getLayer(hillshadeLayerId)) {
    const firstRoad = layers.find((layer) => {
      const sourceLayer = (layer as typeof layer & { "source-layer"?: string })["source-layer"];
      return layer.type === "line" && sourceLayer?.toLowerCase() === "transportation";
    })?.id;
    map.addLayer(
      {
        id: hillshadeLayerId,
        type: "raster",
        source: hillshadeSourceId,
        paint: { "raster-opacity": 0.16, "raster-resampling": "linear" },
      },
      firstRoad,
    );
  }

  const landmarkSourceId = "osogbo-orientation-landmarks";
  if (!map.getSource(landmarkSourceId)) {
    map.addSource(landmarkSourceId, { type: "geojson", data: ORIENTATION_LANDMARKS });
  }
  if (!map.getLayer(`${landmarkSourceId}-markers`)) {
    map.addLayer({
      id: `${landmarkSourceId}-markers`,
      type: "circle",
      source: landmarkSourceId,
      paint: {
        "circle-radius": 5,
        "circle-color": "#d69b32",
        "circle-stroke-color": "#fffaf0",
        "circle-stroke-width": 2,
      },
    });
  }
  if (!map.getLayer(`${landmarkSourceId}-labels`)) {
    map.addLayer({
      id: `${landmarkSourceId}-labels`,
      type: "symbol",
      source: landmarkSourceId,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#173d2b",
        "text-halo-color": "#f2f6ed",
        "text-halo-width": 1.5,
      },
    });
  }
}
