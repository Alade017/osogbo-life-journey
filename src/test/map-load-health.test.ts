import { describe, expect, it, vi } from "vitest";
import {
  isBaseSourceReady,
  isCriticalMapError,
  isWebGlAvailable,
  preflightMapStyle,
} from "@/lib/map-load-health";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("map load health", () => {
  it("reports when WebGL is unavailable", () => {
    const canvas = { getContext: vi.fn(() => null) };
    const documentLike = { createElement: vi.fn(() => canvas) };
    expect(isWebGlAvailable(documentLike as unknown as Pick<Document, "createElement">)).toBe(
      false,
    );
  });

  it("reports a style request failure", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    await expect(
      preflightMapStyle("https://maps.example/style.json", { fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: "style-unavailable" });
  });

  it("reports a blocked vector source even when the style loads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ sources: { openmaptiles: { url: "https://maps.example/planet" } } }),
      )
      .mockResolvedValueOnce(jsonResponse({}, 403));

    await expect(
      preflightMapStyle("https://maps.example/style.json", { fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: "source-unavailable" });
  });

  it("returns the base source ids after a successful preflight", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ sources: { openmaptiles: { url: "./planet" }, local: { tiles: [] } } }),
      )
      .mockResolvedValueOnce(jsonResponse({ tiles: [] }));

    await expect(
      preflightMapStyle("https://maps.example/styles/liberty", { fetchImpl }),
    ).resolves.toEqual({ ok: true, sourceIds: ["openmaptiles", "local"] });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://maps.example/styles/planet",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("classifies base source and forbidden errors as critical before the map is usable", () => {
    const baseSourceIds = new Set(["openmaptiles"]);
    expect(
      isCriticalMapError(
        { sourceId: "openmaptiles", error: { message: "tile failed" } },
        { usable: false, baseSourceIds },
      ),
    ).toBe(true);
    expect(
      isCriticalMapError(
        { error: { status: 403, message: "Forbidden" } },
        { usable: false, baseSourceIds },
      ),
    ).toBe(true);
  });

  it("ignores optional overlays and isolated errors after the map is usable", () => {
    const baseSourceIds = new Set(["openmaptiles"]);
    expect(
      isCriticalMapError(
        { sourceId: "osogbo-elevation-hillshade", error: { status: 403 } },
        { usable: false, baseSourceIds },
      ),
    ).toBe(false);
    expect(
      isCriticalMapError(
        { sourceId: "openmaptiles", error: { status: 403 } },
        { usable: true, baseSourceIds },
      ),
    ).toBe(false);
  });

  it("recognises a loaded base source", () => {
    expect(
      isBaseSourceReady(
        { sourceId: "openmaptiles", isSourceLoaded: true, sourceDataType: "content" },
        new Set(["openmaptiles"]),
      ),
    ).toBe(true);
  });
});
