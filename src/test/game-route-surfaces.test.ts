import { describe, expect, it } from "vitest";
import { phoneRouteTitle, surfaceForPath } from "@/lib/game-route-surfaces";

describe("game route surfaces", () => {
  it("keeps the bottom-navigation destinations full screen", () => {
    expect(surfaceForPath("/home")).toBe("full");
    expect(surfaceForPath("/map/")).toBe("full");
    expect(surfaceForPath("/jobs")).toBe("full");
  });

  it("sends every other game route to the phone", () => {
    for (const path of ["/wallet", "/social", "/location/cedar-bank", "/settings"]) {
      expect(surfaceForPath(path)).toBe("phone");
    }
  });

  it("titles phone routes from their path", () => {
    expect(phoneRouteTitle("/location/cedar-bank")).toBe("Location");
    expect(phoneRouteTitle("/create-character")).toBe("Create character");
  });
});