import { describe, expect, it } from "vitest";
import {
  availableNeighborhoodTargets,
  neighborhoodInteractionPoint,
  neighborhoodNpcNavigationPoint,
  venueEntranceKindForCategory,
} from "@/game/neighborhood-interactions";
import type { NeighborhoodObject } from "@/game/neighborhood-model";

const objects: NeighborhoodObject[] = [
  { id: "home", name: "Home", kind: "home", x: 10, y: 10 },
  { id: "market", name: "Market", kind: "market", x: 20, y: 20 },
  { id: "work", name: "Work", kind: "work", x: 30, y: 30 },
  { id: "npc", name: "Neighbour", kind: "npc", x: 40, y: 40 },
];
const unavailable = {
  hasPersonalHome: false,
  hasHomeType: false,
  hasShopOffers: false,
  hasLocalBusinesses: false,
  hasBankServices: false,
  venueEntranceKind: null,
  hasCareerServices: false,
};

describe("venue entrance category mapping", () => {
  it("routes commercial venues to market entrances", () => {
    expect(venueEntranceKindForCategory("commercial")).toBe("market");
  });

  it.each(["work_industrial", "education", "health", "transport", "government", "recreation", "water_nature"])(
    "routes %s venues to workplace/service entrances",
    (category) => expect(venueEntranceKindForCategory(category)).toBe("work"),
  );

  it.each(["residential", "unknown", null, undefined])(
    "does not infer a venue entrance for %s",
    (category) => expect(venueEntranceKindForCategory(category)).toBeNull(),
  );
});

describe("available neighborhood interaction targets", () => {
  it("hides unavailable building entrances while preserving NPC targets", () => {
    expect(availableNeighborhoodTargets(objects, unavailable).map(({ id }) => id)).toEqual(["npc"]);
  });

  it("requires both personal-home context and a home type", () => {
    expect(
      availableNeighborhoodTargets(objects, { ...unavailable, hasPersonalHome: true }).map(({ id }) => id),
    ).toEqual(["npc"]);
    expect(
      availableNeighborhoodTargets(objects, {
        ...unavailable,
        hasPersonalHome: true,
        hasHomeType: true,
      }).map(({ id }) => id),
    ).toEqual(["home", "npc"]);
  });

  it("maps shop, business and bank services to the market entrance", () => {
    for (const capability of ["hasShopOffers", "hasLocalBusinesses", "hasBankServices"] as const) {
      expect(
        availableNeighborhoodTargets(objects, { ...unavailable, [capability]: true }).map(({ id }) => id),
      ).toEqual(["market", "npc"]);
    }
  });

  it("routes commercial venue interiors to market entrances only", () => {
    expect(
      availableNeighborhoodTargets(objects, {
        ...unavailable,
        venueEntranceKind: "market",
      }).map(({ id }) => id),
    ).toEqual(["market", "npc"]);
  });

  it("routes non-commercial venue interiors to workplace/service entrances only", () => {
    expect(
      availableNeighborhoodTargets(objects, {
        ...unavailable,
        venueEntranceKind: "work",
      }).map(({ id }) => id),
    ).toEqual(["work", "npc"]);
  });

  it("maps career services to the workplace entrance", () => {
    expect(
      availableNeighborhoodTargets(objects, { ...unavailable, hasCareerServices: true }).map(({ id }) => id),
    ).toEqual(["work", "npc"]);
  });

  it("keeps NPCs alongside all available building entrances", () => {
    expect(
      availableNeighborhoodTargets(objects, {
        ...unavailable,
        hasPersonalHome: true,
        hasHomeType: true,
        hasShopOffers: true,
        hasCareerServices: true,
      }).map(({ id }) => id),
    ).toEqual(["home", "market", "work", "npc"]);
  });
});


describe("neighborhood NPC interaction and navigation points", () => {
  const movingNpc = {
    id: "npc",
    x: 42,
    y: 48,
    targetX: 90,
    targetY: 120,
    isMoving: true,
  };

  it("navigates toward the scheduled destination of a moving NPC", () => {
    expect(neighborhoodNpcNavigationPoint(objects[3]!, [movingNpc]))
      .toEqual({ x: 90, y: 120 });
  });

  it("measures interaction range from the moving NPC's actual position", () => {
    expect(neighborhoodInteractionPoint(objects[3]!, [movingNpc]))
      .toEqual({ x: 42, y: 48 });
  });

  it("uses the current position for a stationary NPC for both purposes", () => {
    const stationary = { ...movingNpc, x: 55, y: 65, isMoving: false };
    expect(neighborhoodNpcNavigationPoint(objects[3]!, [stationary]))
      .toEqual({ x: 55, y: 65 });
    expect(neighborhoodInteractionPoint(objects[3]!, [stationary]))
      .toEqual({ x: 55, y: 65 });
  });

  it("keeps building navigation and interaction points on authored coordinates", () => {
    expect(neighborhoodNpcNavigationPoint(objects[1]!, [])).toEqual({ x: 20, y: 20 });
    expect(neighborhoodInteractionPoint(objects[1]!, [])).toEqual({ x: 20, y: 20 });
  });

  it("falls back to the target coordinates if the selected NPC is no longer present", () => {
    expect(neighborhoodNpcNavigationPoint(objects[3]!, []))
      .toEqual({ x: 40, y: 40 });
    expect(neighborhoodInteractionPoint(objects[3]!, []))
      .toEqual({ x: 40, y: 40 });
  });
});
