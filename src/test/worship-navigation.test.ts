import { describe, expect, it } from "vitest";
import { WORSHIP_LAYOUTS } from "@/game/worship-layouts";
import { worshipNavigation } from "@/game/worship-navigation";

describe("worship hall navigation", () => {
  it.each(WORSHIP_LAYOUTS)("$slug keeps the entrance and prayer position reachable", (layout) => {
    const navigation = worshipNavigation(layout);
    expect(navigation.canWalk(layout.spawn)).toBe(true);
    expect(navigation.prayerTarget).not.toBeNull();
    const path = navigation.route(layout.spawn, navigation.prayerTarget!);
    expect(path).not.toBeNull();
    expect(path!.every(navigation.canWalk)).toBe(true);
  });

  it.each(WORSHIP_LAYOUTS)("$slug blocks walls, columns and congregation", (layout) => {
    const navigation = worshipNavigation(layout);
    expect(navigation.canWalk([layout.hall.width / 2, 0])).toBe(false);
    for (const point of layout.columns) expect(navigation.canWalk(point)).toBe(false);
    for (const point of layout.congregation) expect(navigation.canWalk(point)).toBe(false);
  });

  it("does not route through church pews", () => {
    const layout = WORSHIP_LAYOUTS.find((item) => item.faith === "church")!;
    const navigation = worshipNavigation(layout);
    expect(navigation.canWalk(layout.rows[0]!.xs.length ? [layout.rows[0]!.xs[0]!, layout.rows[0]!.z] : [0, 0])).toBe(false);
  });
});
