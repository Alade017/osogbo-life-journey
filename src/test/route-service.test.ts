import { describe, expect, it } from "vitest";
import { hasValidCoordinates, parseOsrmRoute } from "@/lib/route-service";

describe("route service", () => {
  it("accepts valid Osogbo coordinates and rejects missing coordinates", () => {
    expect(hasValidCoordinates({ latitude: 7.7677, longitude: 4.556 })).toBe(true);
    expect(hasValidCoordinates({ latitude: null, longitude: 4.556 })).toBe(false);
    expect(hasValidCoordinates({ latitude: 91, longitude: 4.556 })).toBe(false);
  });

  it("parses distance, duration and GeoJSON route geometry", () => {
    expect(
      parseOsrmRoute({
        code: "Ok",
        routes: [
          {
            distance: 2400,
            duration: 480,
            geometry: {
              type: "LineString",
              coordinates: [
                [4.556, 7.7677],
                [4.56, 7.77],
              ],
            },
          },
        ],
      }),
    ).toEqual({
      distanceMeters: 2400,
      durationSeconds: 480,
      coordinates: [
        [4.556, 7.7677],
        [4.56, 7.77],
      ],
    });
  });

  it("rejects missing or malformed routes instead of inventing a result", () => {
    expect(() => parseOsrmRoute({ code: "NoRoute", routes: [] })).toThrow(
      "A street route is not available",
    );
    expect(() =>
      parseOsrmRoute({
        code: "Ok",
        routes: [
          {
            distance: 12,
            duration: 3,
            geometry: {
              type: "LineString",
              coordinates: [
                [400, 7.7],
                [4.5, 7.8],
              ],
            },
          },
        ],
      }),
    ).toThrow("invalid coordinates");
  });
});
