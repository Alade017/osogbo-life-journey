import { describe, expect, it } from "vitest";
import { createOpenStreetMapFallbackStyle, getOsogboMapStyleUrl } from "@/lib/osogbo-map-style";

describe("Osogbo map styles", () => {
  it("uses a keyless vector style by default", () => {
    expect(getOsogboMapStyleUrl()).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  it("provides an attributed raster fallback when vector tiles fail", () => {
    expect(createOpenStreetMapFallbackStyle()).toMatchObject({
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          attribution: expect.stringContaining("OpenStreetMap contributors"),
        },
      },
      layers: [{ id: "osm-raster-fallback", type: "raster", source: "osm" }],
    });
  });
});
