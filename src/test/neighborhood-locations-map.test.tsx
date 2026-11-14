// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterNeighborhoodLandmarks,
  HOME_MAP_ANCHOR,
  NEIGHBORHOOD_LANDMARKS,
  OLAIYA_ORIGIN,
  scenePointToThreeXZ,
  threeXZToScenePoint,
} from "@/data/neighborhoodLocations";
import { CITY_CENTRE_AREA, toWorld } from "@/game/neighborhood-model";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";
import { planCommuteRoute } from "@/game/commute-route";
import { findInteractableZone } from "@/game/neighborhood-interactions";
import { NeighborhoodCityMap } from "@/components/map/NeighborhoodCityMap";
import {
  consumeNeighborhoodNavigation,
  enqueueNeighborhoodNavigation,
  publishLivePlayerPose,
  readLivePlayerPose,
  resetNeighborhoodNavSyncForTests,
  resolvePlayerMapPosition,
} from "@/store/neighborhoodNavSync";

describe("neighborhoodLocations registry & City Map sync", () => {
  beforeEach(() => {
    resetNeighborhoodNavSyncForTests();
  });

  afterEach(() => {
    cleanup();
    resetNeighborhoodNavSyncForTests();
  });

  it("defines all 6 landmarks with consistent 3D [x, z], 2D normalized coords, and valid zone links", () => {
    expect(NEIGHBORHOOD_LANDMARKS.map((item) => item.id)).toEqual([
      "adire-makers-yard",
      "filling-station-mart",
      "commercial-bank-atm",
      "open-market-buka",
      "roadside-shops-pos",
      "keke-korope-stand",
    ]);

    for (const landmark of NEIGHBORHOOD_LANDMARKS) {
      expect(landmark.mapCoords.x).toBeGreaterThan(0);
      expect(landmark.mapCoords.x).toBeLessThan(1);
      expect(landmark.mapCoords.y).toBeGreaterThan(0);
      expect(landmark.mapCoords.y).toBeLessThan(1);

      const roundTrip = threeXZToScenePoint(landmark.world3D[0], landmark.world3D[1]);
      expect(
        Math.hypot(roundTrip.x - landmark.scenePoint.x, roundTrip.y - landmark.scenePoint.y),
      ).toBeLessThan(1);

      for (const zoneId of landmark.zoneIds) {
        expect(findInteractableZone(zoneId)).not.toBeNull();
      }
      expect(landmark.zoneIds).toContain(landmark.primaryZoneId);
      expect(landmark.kekeFare).toBeGreaterThan(0);
    }
  });

  it("keeps every landmark walkToPoint and dropOffPoint walkable and reachable from Home", () => {
    const startWorld = toWorld(HOME_MAP_ANCHOR.scenePoint, OLAIYA_ORIGIN);

    for (const landmark of NEIGHBORHOOD_LANDMARKS) {
      const walkWorld = toWorld(landmark.walkToPoint, OLAIYA_ORIGIN);
      const dropWorld = toWorld(landmark.dropOffPoint, OLAIYA_ORIGIN);

      expect(
        canOccupyNeighborhoodPoint(
          walkWorld,
          OLAIYA_ORIGIN,
          CITY_CENTRE_AREA.objects,
          CITY_CENTRE_AREA.obstacles,
        ),
      ).toBe(true);

      expect(
        canOccupyNeighborhoodPoint(
          dropWorld,
          OLAIYA_ORIGIN,
          CITY_CENTRE_AREA.objects,
          CITY_CENTRE_AREA.obstacles,
        ),
      ).toBe(true);

      const route = planCommuteRoute(
        startWorld,
        landmark.walkToPoint,
        OLAIYA_ORIGIN,
        CITY_CENTRE_AREA.objects,
        CITY_CENTRE_AREA.obstacles,
      );
      expect(route).not.toBeNull();
      expect(route!.length).toBeGreaterThan(0);
    }
  });

  it("syncs live [x, z] player coordinates between the 3D scene and City Map", () => {
    const pumpScene = { x: 668, y: 242 };
    const [x3d, z3d] = scenePointToThreeXZ(pumpScene);
    publishLivePlayerPose({
      worldX: 9.18,
      worldY: 5.64,
      sceneX: pumpScene.x,
      sceneY: pumpScene.y,
      threeX: x3d,
      threeZ: z3d,
      locationSlug: "city-centre",
      updatedAt: Date.now(),
    });

    const pose = readLivePlayerPose();
    expect(pose).not.toBeNull();
    const resolved = resolvePlayerMapPosition(null, pose);
    expect(resolved.isLive).toBe(true);
    expect(resolved.world3D).toEqual([x3d, z3d]);
  });

  it("filters category pins, opens the location drawer, and triggers Walk Here & Board Keke", () => {
    const onWalkHere = vi.fn();
    const onBoardKeke = vi.fn();

    render(
      <NeighborhoodCityMap
        playerPosition={resolvePlayerMapPosition(null, null)}
        walletBalance={3500}
        offline={false}
        onWalkHere={onWalkHere}
        onBoardKeke={onBoardKeke}
      />,
    );

    expect(filterNeighborhoodLandmarks("work-hustle")).toHaveLength(2);
    expect(filterNeighborhoodLandmarks("food-shops")).toHaveLength(2);
    expect(filterNeighborhoodLandmarks("banking-transit")).toHaveLength(2);

    // Filter to Banking & Transit
    fireEvent.click(screen.getByRole("button", { name: "Banking & Transit" }));
    expect(screen.getByRole("button", { name: /Commercial Bank & ATM/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adire Makers' Yard/i })).not.toBeInTheDocument();

    // Reset filter and open Adire Makers' Yard drawer
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: /Adire Makers' Yard/i }));

    expect(screen.getByRole("dialog", { name: /Adire Makers' Yard details/i })).toBeVisible();
    expect(screen.getByText("Dye Adire Cloth")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Walk Here/i }));
    expect(onWalkHere).toHaveBeenCalledWith(expect.objectContaining({ id: "adire-makers-yard" }));

    fireEvent.click(screen.getByRole("button", { name: /Board Keke \/ Korope/i }));
    expect(onBoardKeke).toHaveBeenCalledWith(
      expect.objectContaining({ id: "adire-makers-yard", kekeFare: 150 }),
    );

    const queued = enqueueNeighborhoodNavigation({
      mode: "keke",
      landmarkId: "adire-makers-yard",
      landmarkName: "Adire Makers' Yard",
      primaryZoneId: "zone-adire-vats",
      targetScenePoint: { x: -165, y: 112 },
      dropOffScenePoint: { x: 255, y: 112 },
      fare: 150,
    });
    expect(queued.mode).toBe("keke");
    expect(consumeNeighborhoodNavigation()?.landmarkId).toBe("adire-makers-yard");
    expect(consumeNeighborhoodNavigation()).toBeNull();
  });

  it("blocks Keke boarding cleanly when pocket wallet balance is below fare", () => {
    const onBoardKeke = vi.fn();

    render(
      <NeighborhoodCityMap
        playerPosition={resolvePlayerMapPosition(null, null)}
        walletBalance={50}
        offline={false}
        onWalkHere={vi.fn()}
        onBoardKeke={onBoardKeke}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Commercial Bank & ATM/i }));
    fireEvent.click(screen.getByRole("button", { name: /Board Keke \/ Korope/i }));

    expect(onBoardKeke).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/pocket cash/i);
  });
});
