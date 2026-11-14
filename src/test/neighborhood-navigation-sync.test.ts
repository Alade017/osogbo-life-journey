import { describe, expect, it } from "vitest";
import {
  NEIGHBORHOOD_LANDMARKS,
  OLAIYA_ORIGIN,
  scenePointToThreeXZ,
  threeXZToScenePoint,
} from "@/data/neighborhoodLocations";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";
import { planCommuteRoute } from "@/game/commute-route";
import {
  findInteractableZone,
  NEIGHBORHOOD_INTERACTABLE_ZONES,
  NEIGHBORHOOD_ZONE_NPCS,
} from "@/game/neighborhood-interactions";
import { neighborhoodAreaForSlug, toWorld } from "@/game/neighborhood-model";
import { surfaceForPath } from "@/lib/game-route-surfaces";

describe("neighborhood navigation and location registry", () => {
  const area = neighborhoodAreaForSlug("city-centre");
  const startWorld = toWorld({ x: 500, y: 240 }, OLAIYA_ORIGIN);

  it("renders /neighborhood, /map, /home, and /jobs as full-screen game surfaces", () => {
    expect(surfaceForPath("/neighborhood")).toBe("full");
    expect(surfaceForPath("/map")).toBe("full");
    expect(surfaceForPath("/home")).toBe("full");
    expect(surfaceForPath("/jobs")).toBe("full");
  });

  it("links all 6 map landmarks cleanly to valid zones with reachable entrances and Keke drop-offs", () => {
    expect(NEIGHBORHOOD_LANDMARKS).toHaveLength(6);

    for (const landmark of NEIGHBORHOOD_LANDMARKS) {
      expect(findInteractableZone(landmark.primaryZoneId)).not.toBeNull();
      expect(landmark.mapCoords.x).toBeGreaterThanOrEqual(0.04);
      expect(landmark.mapCoords.x).toBeLessThanOrEqual(0.96);
      expect(landmark.mapCoords.y).toBeGreaterThanOrEqual(0.04);
      expect(landmark.mapCoords.y).toBeLessThanOrEqual(0.96);

      const walkRoute = planCommuteRoute(
        startWorld,
        landmark.walkToPoint,
        OLAIYA_ORIGIN,
        area.objects,
        area.obstacles,
      );
      expect(walkRoute, `Expected walk route for ${landmark.id}`).not.toBeNull();

      const dropOffWorld = toWorld(landmark.dropOffPoint, OLAIYA_ORIGIN);
      expect(
        canOccupyNeighborhoodPoint(dropOffWorld, OLAIYA_ORIGIN, area.objects, area.obstacles),
        `Expected free Keke drop-off for ${landmark.id}`,
      ).toBe(true);
    }
  });

  it("keeps all 13 interactable zones (including open-doorway interiors) and 5 zone NPCs walkable & reachable", () => {
    const walkInZones = [
      "zone-mini-mart",
      "zone-bank-lobby",
      "zone-shop-barber",
      "zone-shop-accessory",
    ];
    for (const id of walkInZones) {
      expect(findInteractableZone(id)).not.toBeNull();
    }

    for (const zone of NEIGHBORHOOD_INTERACTABLE_ZONES) {
      const accessWorld = toWorld(zone.accessPoint, OLAIYA_ORIGIN);
      expect(
        canOccupyNeighborhoodPoint(accessWorld, OLAIYA_ORIGIN, area.objects, area.obstacles),
        `Zone ${zone.id} accessPoint should not collide`,
      ).toBe(true);

      const route = planCommuteRoute(
        startWorld,
        zone.accessPoint,
        OLAIYA_ORIGIN,
        area.objects,
        area.obstacles,
      );
      expect(route, `Expected commute route to ${zone.id}`).not.toBeNull();
    }

    for (const npc of NEIGHBORHOOD_ZONE_NPCS) {
      const accessWorld = toWorld(npc.accessPoint, OLAIYA_ORIGIN);
      expect(
        canOccupyNeighborhoodPoint(accessWorld, OLAIYA_ORIGIN, area.objects, area.obstacles),
        `NPC ${npc.id} accessPoint should not collide`,
      ).toBe(true);

      const route = planCommuteRoute(
        startWorld,
        npc.accessPoint,
        OLAIYA_ORIGIN,
        area.objects,
        area.obstacles,
      );
      expect(route, `Expected commute route to NPC ${npc.id}`).not.toBeNull();
    }
  });

  it("round-trips 3D [x, z] scene coordinates with Olaiya scene points", () => {
    const sample = { x: 820, y: 230 };
    const [x3d, z3d] = scenePointToThreeXZ(sample);
    const recovered = threeXZToScenePoint(x3d, z3d);
    expect(Math.abs(recovered.x - sample.x)).toBeLessThan(0.5);
    expect(Math.abs(recovered.y - sample.y)).toBeLessThan(0.5);
  });
});
