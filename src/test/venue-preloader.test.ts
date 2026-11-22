import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { preloadVenueModule } from "@/components/game/venue-preloader";
import { venueSceneLoaders } from "@/components/game/venue-scene-loaders";

vi.mock("@/components/game/venue-scene-loaders", () => ({
  venueSceneLoaders: { clinic: vi.fn(), bank: vi.fn(), mall: vi.fn() },
}));

const base = getLocationVenueDesign("unknown-location", "Test Venue");

describe("preloadVenueModule", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads only the selected specialized scene", async () => {
    await expect(preloadVenueModule("test-venue", {
      ...base, scene: "clinic",
    })).resolves.toBe(true);
    expect(venueSceneLoaders.clinic).toHaveBeenCalledTimes(1);
    expect(venueSceneLoaders.bank).not.toHaveBeenCalled();
    expect(venueSceneLoaders.mall).not.toHaveBeenCalled();
  });

  it("handles module-loading failure", async () => {
    vi.mocked(venueSceneLoaders.clinic).mockRejectedValueOnce(new Error("Module loading failed"));
    await expect(preloadVenueModule("test-venue", {
      ...base, scene: "clinic",
    })).resolves.toBe(false);
  });

  it("skips generic scenes", async () => {
    await expect(preloadVenueModule("test-venue", base)).resolves.toBe(false);
    expect(venueSceneLoaders.clinic).not.toHaveBeenCalled();
    expect(venueSceneLoaders.bank).not.toHaveBeenCalled();
    expect(venueSceneLoaders.mall).not.toHaveBeenCalled();
  });

  it("skips environment-only scenes", async () => {
    await expect(preloadVenueModule("test-venue", {
      ...base, environment: { url: "/test.glb" },
    })).resolves.toBe(false);
  });

  it("preserves specialized scene priority", async () => {
    await expect(preloadVenueModule("test-venue", {
      ...base, scene: "clinic", bankInterior: "teller-hall",
    })).resolves.toBe(true);
    expect(venueSceneLoaders.clinic).toHaveBeenCalledTimes(1);
    expect(venueSceneLoaders.bank).not.toHaveBeenCalled();
  });

  it("requires a location ID for mall loading", async () => {
    await expect(preloadVenueModule("osun-mall", base)).resolves.toBe(false);
    await expect(preloadVenueModule("osun-mall", base, "location-1")).resolves.toBe(true);
    expect(venueSceneLoaders.mall).toHaveBeenCalledTimes(1);
  });
});
