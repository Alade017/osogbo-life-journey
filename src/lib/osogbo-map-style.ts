import type { FilterSpecification, Map as MapLibreMap } from "maplibre-gl";
import { getSceneColor } from "@/lib/scene-colors";

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

type MapStyleEnvironment = {
  VITE_OSOGBO_MAP_STYLE_URL?: string;
  VITE_OSOGBO_MAP_FALLBACK_STYLE_URL?: string;
  VITE_STADIA_MAPS_API_KEY?: string;
};

function withPublishableStadiaKey(styleUrl: string, apiKey?: string) {
  if (!apiKey || !styleUrl.startsWith("https://tiles.stadiamaps.com/")) return styleUrl;

  const url = new URL(styleUrl);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export function buildOsogboMapStyleUrls(environment: MapStyleEnvironment = {}) {
  const primary = environment.VITE_OSOGBO_MAP_STYLE_URL || DEFAULT_VECTOR_STYLE;
  const secondary = environment.VITE_OSOGBO_MAP_FALLBACK_STYLE_URL;
  return [...new Set([primary, secondary].filter((value): value is string => Boolean(value)))].map(
    (styleUrl) => withPublishableStadiaKey(styleUrl, environment.VITE_STADIA_MAPS_API_KEY),
  );
}

export function getOsogboMapStyleUrls() {
  return buildOsogboMapStyleUrls({
    VITE_OSOGBO_MAP_STYLE_URL: import.meta.env["VITE_OSOGBO_MAP_STYLE_URL"],
    VITE_OSOGBO_MAP_FALLBACK_STYLE_URL: import.meta.env["VITE_OSOGBO_MAP_FALLBACK_STYLE_URL"],
    VITE_STADIA_MAPS_API_KEY: import.meta.env["VITE_STADIA_MAPS_API_KEY"],
  });
}

export function getOsogboMapStyleUrl(): string {
  return getOsogboMapStyleUrls()[0]!;
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
      map.setPaintProperty(layer.id, "background-color", getSceneColor("--brand-porcelain"));
      continue;
    }

    if (layer.type === "fill" && (sourceLayer === "water" || id.includes("water"))) {
      map.setPaintProperty(layer.id, "fill-color", getSceneColor("--scene-sky"));
      map.setPaintProperty(layer.id, "fill-opacity", 0.95);
    } else if (
      layer.type === "fill" &&
      (sourceLayer === "park" || id.includes("park") || id.includes("wood"))
    ) {
      map.setPaintProperty(layer.id, "fill-color", getSceneColor("--scene-hill"));
    } else if (layer.type === "fill" && (sourceLayer === "building" || id.includes("building"))) {
      map.setPaintProperty(layer.id, "fill-color", getSceneColor("--color-surface"));
      map.setPaintProperty(layer.id, "fill-outline-color", getSceneColor("--brand-mist"));
    } else if (layer.type === "line" && sourceLayer === "transportation") {
      map.setPaintProperty(layer.id, "line-color", [
        "match",
        ["get", "class"],
        ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"],
        getSceneColor("--scene-accent"),
        ["secondary", "secondary_link", "tertiary", "tertiary_link"],
        getSceneColor("--brand-cream"),
        ["rail", "transit", "ferry"],
        getSceneColor("--brand-slate"),
        getSceneColor("--color-surface"),
      ]);
    } else if (layer.type === "line" && sourceLayer === "waterway") {
      map.setPaintProperty(layer.id, "line-color", getSceneColor("--scene-sky"));
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
      map.setPaintProperty(layer.id, "text-color", getSceneColor("--brand-ink"));
      map.setPaintProperty(layer.id, "text-halo-color", getSceneColor("--brand-porcelain"));
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
        "circle-color": getSceneColor("--scene-accent"),
        "circle-stroke-color": getSceneColor("--brand-cream"),
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
        "text-color": getSceneColor("--brand-ink"),
        "text-halo-color": getSceneColor("--brand-porcelain"),
        "text-halo-width": 1.5,
      },
    });
  }
}
