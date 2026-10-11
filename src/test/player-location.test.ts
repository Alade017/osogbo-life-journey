import { describe, expect, it } from "vitest";
import type { Character, MapLocation } from "@/lib/game";
import { normalizeCityLocation } from "@/lib/location-service";
import { resolvePlayerLocation } from "@/lib/player-location";

function location(overrides: Partial<MapLocation> = {}) {
  return normalizeCityLocation({
    id: "district-a",
    name: "Central District",
    slug: "central-district",
    type: "custom",
    description: "A central district.",
    latitude: 7.7677,
    longitude: 4.556,
    icon: "map-pin",
    image_url: null,
    is_active: true,
    interaction_radius_m: 50,
    level_required: 0,
    metadata: {},
    ...overrides,
  });
}

function character(current_location_id: string | null): Character {
  return {
    id: "character-a",
    name: "Player One",
    current_location_id,
  } as Character;
}

describe("player location source", () => {
  it("associates saved position with the authenticated character and district", () => {
    const playerLocation = resolvePlayerLocation(character("district-a"), [location()]);

    expect(playerLocation).toMatchObject({
      playerId: "character-a",
      playerName: "Player One",
      currentLocationId: "district-a",
      latitude: 7.7677,
      longitude: 4.556,
      movementStatus: "idle",
      destinationId: null,
      location: { name: "Central District" },
    });
  });

  it("uses the virtual Osogbo spawn when the district lacks map coordinates", () => {
    const locations = [location(), location({ id: "district-b", latitude: null, longitude: null })];

    expect(resolvePlayerLocation(character("district-b"), locations)).toMatchObject({
      currentLocationId: "district-b",
      location: { id: "district-b" },
      latitude: 7.7677,
      longitude: 4.556,
    });
  });

  it("returns no player position while the character is unavailable", () => {
    expect(resolvePlayerLocation(null, [location()])).toBeNull();
  });
});
