import { expect, it } from "vitest";
import { neighborhoodTripEstimate } from "@/game/neighborhood-transit";
const destination = {
  id: "market",
  is_active: true,
  travel_fare: 100,
  travel_minutes: 20,
  metadata: null,
};
it("quotes each destination using its saved route costs", () => {
  expect(neighborhoodTripEstimate(destination, "city", "keke")).toMatchObject({
    fare: 115,
    minutes: 21,
  });
  expect(
    neighborhoodTripEstimate({ ...destination, travel_fare: 1000 }, "city", "keke")!.fare,
  ).toBe(1150);
  expect(neighborhoodTripEstimate(destination, "city", "walking")!.fare).toBe(0);
});
it("does not quote invalid, inactive, current or mode-restricted routes", () => {
  expect(neighborhoodTripEstimate(destination, undefined, "keke")).toBeNull();
  expect(neighborhoodTripEstimate(destination, "market", "keke")).toBeNull();
  expect(neighborhoodTripEstimate({ ...destination, is_active: false }, "city", "keke")).toBeNull();
  expect(neighborhoodTripEstimate({ ...destination, travel_fare: NaN }, "city", "keke")).toBeNull();
  expect(
    neighborhoodTripEstimate(
      { ...destination, metadata: { available_transport_modes: ["walking"] } },
      "city",
      "keke",
    ),
  ).toBeNull();
});
