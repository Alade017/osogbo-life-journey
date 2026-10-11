import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NearbyLocationPrompt } from "@/components/game/NearbyLocationPrompt";
import { normalizeCityLocation } from "@/lib/location-service";
import { subscribeLocationInteractionRequests } from "@/lib/nearby-location-service";
import type { MapLocation } from "@/lib/game";

describe("nearby location prompt", () => {
  it("shows a touch-friendly prompt and handles interaction button activation", () => {
    const location = normalizeCityLocation({
      id: "market-a",
      name: "Oja Oba Market",
      slug: "oja-oba-market",
      type: "market",
      description: "Central market.",
      latitude: 7.7677,
      longitude: 4.556,
      icon: "store",
      image_url: null,
      is_active: true,
      interaction_radius_m: 50,
      level_required: 0,
      metadata: {},
    } satisfies MapLocation);
    const listener = vi.fn();
    const unsubscribe = subscribeLocationInteractionRequests(listener);
    render(
      <NearbyLocationPrompt
        nearbyLocations={[{ location, distanceMeters: 12, meetsLevelRequirement: true }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Interact with Oja Oba Market" }));
    expect(screen.getByText("You're near Oja Oba Market")).toBeInTheDocument();
    expect(listener).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Ready to interact with Oja Oba Market.");
    unsubscribe();
  });
});
