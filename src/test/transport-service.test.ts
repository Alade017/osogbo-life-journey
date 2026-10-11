import { describe, expect, it } from "vitest";
import {
  estimateTrip,
  getAvailableTravelModes,
  travelAnimationDurationMs,
  validateTripRequest,
} from "@/lib/transport-service";

describe("transport service", () => {
  it("estimates costs and durations by game transport mode", () => {
    expect(estimateTrip("walking", 250, 8)).toMatchObject({ fare: 0, minutes: 20 });
    expect(estimateTrip("danfo", 250, 8)).toMatchObject({ fare: 188, minutes: 15 });
    expect(estimateTrip("car", 250, 8)).toMatchObject({ fare: 550, minutes: 8 });
  });

  it("keeps the visible trip sequence accelerated and bounded", () => {
    expect(travelAnimationDurationMs(1)).toBe(1_000);
    expect(travelAnimationDurationMs(10)).toBe(1_800);
    expect(travelAnimationDurationMs(120)).toBe(5_000);
  });

  it("uses all simulated modes by default and honors location restrictions", () => {
    expect(getAvailableTravelModes({})).toEqual(["walking", "danfo", "keke", "okada", "car"]);
    expect(getAvailableTravelModes({ available_transport_modes: ["walking", "keke"] })).toEqual([
      "walking",
      "keke",
    ]);
  });

  it("rejects current, invalid, unavailable and unaffordable trip requests", () => {
    const base = {
      destinationId: "other",
      currentLocationId: "home",
      mode: "danfo" as const,
      availableModes: ["walking", "danfo"] as const,
      balance: 100,
      fare: 80,
    };
    expect(validateTripRequest(base)).toBeNull();
    expect(validateTripRequest({ ...base, destinationId: null })).toMatch(/valid destination/);
    expect(validateTripRequest({ ...base, currentLocationId: "other" })).toMatch(/already/);
    expect(validateTripRequest({ ...base, mode: "car" })).toMatch(/unavailable/);
    expect(validateTripRequest({ ...base, balance: 50 })).toMatch(/more/);
  });
});
