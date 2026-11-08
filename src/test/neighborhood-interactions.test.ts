import { describe, expect, it } from "vitest";
import {
  availableNeighborhoodTargets,
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
