import { describe, expect, it } from "vitest";
import {
  MALL_BUBBLE_SECONDS,
  MALL_MAX_BUBBLES,
  PLAYER_BUBBLE_ID,
  addBubble,
  bubbleAnchor,
  bubbleTargetFor,
  pruneBubbles,
  splitSpeaker,
  type MallBubble,
} from "@/game/mall-bubbles";

describe("mall speech bubbles", () => {
  it("shows a bubble for four seconds", () => {
    const { bubbles } = addBubble([], "shopper-1", "Shopper: Hi", 1000, 1);
    expect(bubbles[0]?.expiresAt).toBe(1000 + MALL_BUBBLE_SECONDS * 1000);
  });

  it("replaces the bubble of the same character and gives it a new id", () => {
    const first = addBubble([], "till-1", "Cashier: One", 0, 1);
    const second = addBubble(first.bubbles, "till-1", "Cashier: Two", 100, first.nextId);
    expect(second.bubbles).toHaveLength(1);
    expect(second.bubbles[0]?.text).toBe("Cashier: Two");
    expect(second.bubbles[0]?.id).not.toBe(first.bubbles[0]?.id);
  });

  it("keeps at most the limit, dropping the oldest bubble first", () => {
    let state: { bubbles: MallBubble[]; nextId: number } = { bubbles: [], nextId: 1 };
    for (let index = 0; index < MALL_MAX_BUBBLES + 2; index += 1) {
      state = addBubble(state.bubbles, `shopper-${index}`, `line ${index}`, index, state.nextId);
    }
    expect(state.bubbles).toHaveLength(MALL_MAX_BUBBLES);
    expect(state.bubbles.map((bubble) => bubble.targetId)).toEqual([
      "shopper-2",
      "shopper-3",
      "shopper-4",
      "shopper-5",
      "shopper-6",
    ]);
  });

  it("removes expired bubbles and keeps the rest", () => {
    const { bubbles } = addBubble([], "a", "A: one", 0, 1);
    const later = addBubble(bubbles, "b", "B: two", 3000, 2);
    const pruned = pruneBubbles(later.bubbles, MALL_BUBBLE_SECONDS * 1000 + 1);
    expect(pruned.map((bubble) => bubble.targetId)).toEqual(["b"]);
  });

  it("returns the same array when nothing has expired", () => {
    const { bubbles } = addBubble([], "a", "A: one", 0, 1);
    expect(pruneBubbles(bubbles, 100)).toBe(bubbles);
  });

  it("splits a speaker label from the line", () => {
    expect(splitSpeaker("Cashier: Next, please.")).toEqual({
      speaker: "Cashier",
      line: "Next, please.",
    });
    expect(splitSpeaker("You put down a shopping basket.")).toEqual({
      speaker: null,
      line: "You put down a shopping basket.",
    });
  });

  it("speaks over a clicked person and over the visitor for fixtures", () => {
    expect(bubbleTargetFor({ kind: "shopper", id: "shopper-4" }, [0, 0])).toBe("shopper-4");
    expect(bubbleTargetFor({ kind: "staff", role: "floor", id: "floor-1" }, [0, 0])).toBe(
      "floor-1",
    );
    expect(bubbleTargetFor({ kind: "shelf", id: "mall-shelves" }, [0, 0])).toBe(PLAYER_BUBBLE_ID);
  });

  it("speaks a till line over the cashier nearest the visitor", () => {
    expect(bubbleTargetFor({ kind: "till", id: "mall-checkout" }, [4.7, 3])).toBe("till-3");
  });
});

describe("bubble anchors", () => {
  const state = {
    player: { pos: [1, 2] as [number, number] },
    shoppers: [{ id: "shopper-7", walker: { pos: [3, 4] as [number, number] } }],
  };

  it("follows the visitor, a moving shopper, and a fixed member of staff", () => {
    expect(bubbleAnchor(PLAYER_BUBBLE_ID, state)).toEqual([1, 2]);
    expect(bubbleAnchor("shopper-7", state)).toEqual([3, 4]);
    expect(bubbleAnchor("till-1", state)).toEqual([2.6, 2.2]);
  });

  it("returns nothing for a shopper who has left", () => {
    expect(bubbleAnchor("shopper-99", state)).toBeNull();
  });
});
