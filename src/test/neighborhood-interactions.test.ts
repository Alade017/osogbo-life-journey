import { describe, expect, it } from "vitest";
import { availableNeighborhoodTargets } from "@/game/neighborhood-interactions";
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
  hasVenueInterior: false,
  hasCareerServices: false,
};

describe("available neighborhood interaction targets", () => {
  it("hides entrances when their domain action is unavailable", () => {
    expect(availableNeighborhoodTargets(objects, unavailable)).toEqual([]);
  });
  it("requires both personal-home context and a home type", () => {
    expect(availableNeighborhoodTargets(objects, { ...unavailable, hasPersonalHome: true })).toEqual([]);
    expect(
      availableNeighborhoodTargets(objects, { ...unavailable, hasPersonalHome: true, hasHomeType: true }).map(({ id }) => id),
    ).toEqual(["home"]);
  });
  it("maps each available service to its corresponding entrance", () => {
    const cases = [
      ["hasShopOffers", "market"],
      ["hasLocalBusinesses", "market"],
      ["hasBankServices", "market"],
      ["hasVenueInterior", "market"],
      ["hasCareerServices", "work"],
    ] as const;
    for (const [capability, expected] of cases) {
      expect(
        availableNeighborhoodTargets(objects, { ...unavailable, [capability]: true }).map(({ id }) => id),
      ).toEqual([expected]);
    }
  });
  it("preserves NPCs as interaction targets independently of building services", () => {
    expect(availableNeighborhoodTargets(objects, unavailable).map(({ id }) => id)).toEqual(["npc"]);
  });
  it("keeps NPCs alongside available building entrances", () => {
    expect(
      availableNeighborhoodTargets(objects, { ...unavailable, hasShopOffers: true, hasCareerServices: true }).map(({ kind }) => kind),
    ).toEqual(["market", "work", "npc"]);
  });
});
