import { describe, expect, it } from "vitest";
import { residentialCompoundNavigation, RESIDENTIAL_COMPOUND_SPAWN } from "@/game/residential-compound-navigation";
import { compoundFeatures } from "@/game/residential-compound";

describe("residential compound navigation", () => {
  const navigation = residentialCompoundNavigation();

  it("starts inside the gate and keeps the courtyard within its boundary", () => {
    expect(navigation.canWalk(RESIDENTIAL_COMPOUND_SPAWN)).toBe(true);
    expect(navigation.canWalk([0, 9.4])).toBe(true);
    expect(navigation.canWalk([10, 0])).toBe(false);
    expect(navigation.canWalk([0, -10])).toBe(false);
  });

  it("routes around the main home, neighbouring homes and shared fixtures", () => {
    expect(navigation.canWalk([0, -5])).toBe(false);
    expect(navigation.canWalk([-7, 0])).toBe(false);
    expect(navigation.canWalk([5.5, 6])).toBe(false);
    const route = navigation.route(RESIDENTIAL_COMPOUND_SPAWN, [0, 0]);
    expect(route).not.toBeNull();
    expect(route!.every(navigation.canWalk)).toBe(true);
  });

  it.each(compoundFeatures(true))("finds a reachable approach for $label", (feature) => {
    const route = navigation.approach(RESIDENTIAL_COMPOUND_SPAWN, feature.id);
    expect(route).not.toBeNull();
    expect(route!.every(navigation.canWalk)).toBe(true);
  });

  it("rejects invalid floor taps and snaps taps on solid objects to walkable ground", () => {
    expect(navigation.nearest([Number.NaN, 0])).toBeNull();
    const point = navigation.nearest([0, -5]);
    expect(point).not.toBeNull();
    expect(navigation.canWalk(point!)).toBe(true);
    expect(navigation.nearest([100, 100])).toBeNull();
  });
});
