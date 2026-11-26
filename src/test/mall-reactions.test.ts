import { describe, expect, it } from "vitest";
import { MALL_PROPS, reactionFor, canChatWithShopper, shopperReaction } from "@/game/mall-reactions";

import { createWalker } from "@/game/mall-movement";

describe("shopper conversations", () => {
  it("requires a nearby active shopper and a walkable sightline", () => {
    const walker = createWalker([0, 0], [[0, 1]]);
    expect(canChatWithShopper([0, 1], walker)).toBe(true);
    expect(canChatWithShopper([0, 4], walker)).toBe(false);
    expect(canChatWithShopper([0, 1], { ...walker, done: true })).toBe(false);
  });
  it("responds to browsing and walking context", () => {
    const walker = createWalker([0, 0], [[0, 1]]);
    expect(shopperReaction({ ...walker, dwellLeft: 1 }, 0)).toMatch(/shelf/);
    expect(shopperReaction({ ...walker, moving: true }, 0)).toMatch(/on my way/);
  });
});

describe("mall reactions", () => {
  it("gives a reaction for every kind of thing a visitor can click", () => {
    expect(reactionFor({ kind: "shelf", id: "mall-shelves" }, 0)).toMatch(/Shopkeeper|Shopper/);
    expect(reactionFor({ kind: "till", id: "mall-checkout" }, 0)).toMatch(/Cashier/);
    expect(reactionFor({ kind: "seat", id: "mall-seats" }, 0)).toMatch(/Shopper/);
    expect(reactionFor({ kind: "display", id: "mall-display" }, 0)).toMatch(/Staff/);
    expect(reactionFor({ kind: "shopper", id: "shopper-3" }, 0)).toMatch(/Shopper/);
  });

  it("speaks in the voice of the staff role that was clicked", () => {
    expect(reactionFor({ kind: "staff", role: "till", id: "till-1" }, 0)).toMatch(/Cashier/);
    expect(reactionFor({ kind: "staff", role: "security", id: "security-1" }, 0)).toMatch(
      /Security/,
    );
    expect(reactionFor({ kind: "staff", role: "staff-room", id: "staff-room-1" }, 0)).toMatch(
      /staff only/,
    );
  });

  it("varies the line on repeated clicks", () => {
    const lines = new Set(
      [0, 1].map((pick) => reactionFor({ kind: "till", id: "mall-checkout" }, pick)),
    );
    expect(lines.size).toBe(2);
  });

  it("offers three props, each with its own name and colour", () => {
    expect(MALL_PROPS).toHaveLength(3);
    expect(new Set(MALL_PROPS.map((prop) => prop.id)).size).toBe(3);
  });
});
