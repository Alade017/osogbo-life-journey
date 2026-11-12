import { describe, expect, it } from "vitest";
import {
  GUIDE_ZONE_BOUNDS,
  arrangementWarnings,
  guideFor,
  houseDoorPercentX,
} from "@/components/game/housing/house-arrangement-guide";
import { FOUR_ROOM_HOME_TYPES } from "@/components/game/housing/house-room-contract";

describe("arrangement guide suggestions", () => {
  it("suggests the sleep corner for beds and the wet tiles for bathroom fittings", () => {
    expect(guideFor("bed", "bed")?.zoneBounds).toEqual(GUIDE_ZONE_BOUNDS.sleep);
    expect(guideFor("bathroom", "shower")?.zoneBounds).toEqual(GUIDE_ZONE_BOUNDS.wet);
    expect(guideFor("kitchen", "stove")?.zoneBounds).toEqual(GUIDE_ZONE_BOUNDS.kitchen);
  });

  it("gives a hint without a zone for plants and decor", () => {
    expect(guideFor("plant", "plant")).toEqual({
      hint: "In a corner or on a wall, clear of the paths.",
      zoneBounds: null,
    });
  });

  it("has nothing for items the guide does not cover", () => {
    expect(guideFor("fitness", "treadmill")).toBeNull();
  });

  it("treats wall art as a back-wall placement with no zone", () => {
    expect(guideFor("decor", "wall-art-canvas")).toEqual({
      hint: "On the back wall. Slide it to where you want it.",
      zoneBounds: null,
    });
  });
});

describe("arrangement guide warnings", () => {
  const doorX = 74;

  it("warns when a bed sits in the middle of the room", () => {
    expect(arrangementWarnings("bed", "bed", 50, 50, doorX)).toContain(
      "Beds sit best against a wall, ideally in a corner.",
    );
  });

  it("does not warn when a bed is against a wall", () => {
    expect(arrangementWarnings("bed", "bed", 8, 40, doorX)).toEqual([]);
  });

  it("warns about soft furniture on the wet tiles", () => {
    expect(arrangementWarnings("seat", "sofa", 80, 20, doorX)).toContain(
      "Keep soft furniture off the wet tiles.",
    );
  });

  it("warns when bathroom fittings are off the wet tiles", () => {
    expect(arrangementWarnings("bathroom", "shower", 20, 70, doorX)).toContain(
      "Shower, toilet and sink belong on the wet tiles.",
    );
  });

  it("warns when cooking items are on the sleep side", () => {
    expect(arrangementWarnings("kitchen", "stove", 20, 80, doorX)).toContain(
      "Cooking items sit on the right side, near the sink.",
    );
  });

  it("warns when an item blocks the path from the door", () => {
    expect(arrangementWarnings("storage", "wardrobe", 74, 60, doorX)).toContain(
      "Keep the path from the door clear.",
    );
  });

  it("never warns about wall art", () => {
    expect(arrangementWarnings("decor", "wall-art", 74, 60, doorX)).toEqual([]);
  });

  it("puts the door on the right side of four-room and other homes", () => {
    expect(houseDoorPercentX(FOUR_ROOM_HOME_TYPES[0] ?? "")).toBe(22);
    expect(houseDoorPercentX("studio-test")).toBe(74);
  });
});
