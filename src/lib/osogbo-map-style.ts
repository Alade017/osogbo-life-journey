import type { Map as MapLibreMap } from "maplibre-gl";

const STADIA_VECTOR_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth.json";
const OSM_RASTER_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

export function getOsogboMapStyleUrl(): string {
  const styleUrl = import.meta.env["VITE_OSOGBO_MAP_STYLE_URL"] || STADIA_VECTOR_STYLE;
  const apiKey = import.meta.env["VITE_STADIA_MAPS_API_KEY"];
  if (!apiKey || !styleUrl.startsWith("https://tiles.stadiamaps.com/")) return styleUrl;

  const url = new URL(styleUrl);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export function createDevelopmentMapFallbackStyle() {
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: OSM_RASTER_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "osm-raster-fallback",
        type: "raster" as const,
        source: "osm",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

/** Apply the Osogbo Life warm roads, blue waterways, green parks, and navy labels to OMT layers. */
export function applyOsogboMapPalette(map: MapLibreMap) {
  if (!map.isStyleLoaded()) return;
  const layers = map.getStyle().layers;

  for (const layer of layers) {
    const spec = layer as typeof layer & { "source-layer"?: string };
    const sourceLayer = spec["source-layer"]?.toLowerCase() ?? "";
    const id = layer.id.toLowerCase();

    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", "#f4f0e7");
      continue;
    }

    if (layer.type === "fill" && (sourceLayer === "water" || id.includes("water"))) {
      map.setPaintProperty(layer.id, "fill-color", "#b8d5de");
      map.setPaintProperty(layer.id, "fill-opacity", 0.95);
    } else if (
      layer.type === "fill" &&
      (sourceLayer === "park" || id.includes("park") || id.includes("wood"))
    ) {
      map.setPaintProperty(layer.id, "fill-color", "#c8d9bd");
    } else if (layer.type === "fill" && (sourceLayer === "building" || id.includes("building"))) {
      map.setPaintProperty(layer.id, "fill-color", "#e2d9cb");
      map.setPaintProperty(layer.id, "fill-outline-color", "#d0c5b5");
    } else if (layer.type === "line" && sourceLayer === "transportation") {
      map.setPaintProperty(layer.id, "line-color", [
        "match",
        ["get", "class"],
        ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"],
        "#dfa75f",
        ["secondary", "secondary_link", "tertiary", "tertiary_link"],
        "#efdab6",
        ["rail", "transit", "ferry"],
        "#a99a84",
        "#faf5e9",
      ]);
    } else if (layer.type === "line" && sourceLayer === "waterway") {
      map.setPaintProperty(layer.id, "line-color", "#a5cbd7");
    } else if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      map.setPaintProperty(layer.id, "text-color", "#34485f");
      map.setPaintProperty(layer.id, "text-halo-color", "#fffdf8");
      map.setPaintProperty(layer.id, "text-halo-width", 1.1);
    }
  }
}
