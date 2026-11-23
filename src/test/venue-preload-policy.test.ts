import { afterEach, describe, expect, it, vi } from "vitest";
import { canPreloadVenue, canPreloadVenueInBrowser } from "@/lib/venue-preload-policy";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("canPreloadVenue", () => {
  it.each(["slow-2g", "2g"])("skips speculative loading on %s", (effectiveType) => {
    expect(canPreloadVenue({ effectiveType })).toBe(false);
  });
  it.each(["3g", "4g"])("allows speculative loading on %s", (effectiveType) => {
    expect(canPreloadVenue({ effectiveType })).toBe(true);
  });
  it("respects data saver", () => {
    expect(canPreloadVenue({ effectiveType: "4g", saveData: true })).toBe(false);
  });
  it("supports unavailable connection information", () => {
    expect(canPreloadVenue()).toBe(true);
  });
});

describe("canPreloadVenueInBrowser", () => {
  it("skips loading outside browser environments", () => {
    vi.stubGlobal("navigator", undefined);
    expect(canPreloadVenueInBrowser()).toBe(false);
  });
  it("skips loading while offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(canPreloadVenueInBrowser()).toBe(false);
  });
  it("supports browsers without the Network Information API", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(canPreloadVenueInBrowser()).toBe(true);
  });
  it("respects browser data saver", () => {
    vi.stubGlobal("navigator", {
      onLine: true,
      connection: { saveData: true, effectiveType: "4g" },
    });
    expect(canPreloadVenueInBrowser()).toBe(false);
  });
});
