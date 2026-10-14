import type { Map as MapLibreMap } from "maplibre-gl";

const DEFAULT_VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const OSM_RASTER_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

export function getOsogboMapStyleUrl(): string {
  const styleUrl = import.meta.env["VITE_OSOGBO_MAP_STYLE_URL"] || DEFAULT_VECTOR_STYLE;
  const apiKey = import.meta.env["VITE_STADIA_MAPS_API_KEY"];
  if (!apiKey || !styleUrl.startsWith("https://tiles.stadiamaps.com/")) return styleUrl;

  const url = new URL(styleUrl);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export function createOpenStreetMapFallbackStyle() {
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

/** Apply the Osogbo Life ivory, forest green, gold, and soft water palette to OMT layers. */
export function applyOsogboMapPalette(map: MapLibreMap) {
  if (!map.isStyleLoaded()) return;
  const layers = map.getStyle().layers;

  for (const layer of layers) {
    const spec = layer as typeof layer & { "source-layer"?: string };
    const sourceLayer = spec["source-layer"]?.toLowerCase() ?? "";
    const id = layer.id.toLowerCase();

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
      map.setPaintProperty(layer.id, "text-color", "#173d2b");
      map.setPaintProperty(layer.id, "text-halo-color", "#f2f6ed");
      map.setPaintProperty(layer.id, "text-halo-width", 1.1);
    }
  }

  // Extrude only real OSM building footprints at close zoom; this adds depth without
  // turning the whole city into a costly 3D scene on small screens.
  const buildingLayer = layers.find((layer) => {
    const spec = layer as typeof layer & { "source-layer"?: string };
    return layer.type === "fill" && spec["source-layer"]?.toLowerCase() === "building";
  }) as ((typeof layers)[number] & { "source-layer"?: string; source: string }) | undefined;
  if (
    buildingLayer &&
    buildingLayer["source-layer"] &&
    !map.getLayer("osogbo-building-extrusions")
  ) {
    const firstSymbol = layers.find((layer) => layer.type === "symbol")?.id;
    map.addLayer(
      {
        id: "osogbo-building-extrusions",
        type: "fill-extrusion",
        source: buildingLayer.source,
        "source-layer": buildingLayer["source-layer"],
        minzoom: 15.5,
        filter: ["any", ["has", "render_height"], ["has", "height"]],
        paint: {
          "fill-extrusion-color": "#e9e5d8",
          "fill-extrusion-height": [
            "max",
            ["to-number", ["get", "render_height"], 0],
            ["to-number", ["get", "height"], 0],
          ],
          "fill-extrusion-base": [
            "max",
            ["to-number", ["get", "render_min_height"], 0],
            ["to-number", ["get", "min_height"], 0],
          ],
          "fill-extrusion-opacity": 0.82,
        },
      },
      firstSymbol,
    );
  }
}
