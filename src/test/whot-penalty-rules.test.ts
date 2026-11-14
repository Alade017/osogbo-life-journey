import { describe, expect, it } from "vitest";
import {
  canPlayCard,
  drawWhot,
  playWhot,
  playableCards,
  type Card,
  type WhotState,
} from "@/lib/mini-games/whot";

const card = (id: string, shape: Card["shape"], rank: number): Card => ({ id, shape, rank });

function game(overrides: Partial<WhotState>): WhotState {
  return {
    playerCount: 2,
    hands: [[], []],
    stock: [
      card("s1", "star", 1),
      card("s2", "star", 3),
      card("s3", "star", 4),
      card("s4", "star", 7),
    ],
    discard: [card("top", "circle", 3)],
    shape: "circle",
    turn: 0,
    pendingDraw: 0,
    pendingRank: null,
    winner: null,
    ...overrides,
  };
}

describe("whot penalties", () => {
  it("a 2 defends a Pick Two and the penalty stacks to four without drawing", () => {
    const state = game({
      hands: [[card("c2", "circle", 2), card("x", "cross", 9)], [card("o", "cross", 11)]],
      pendingDraw: 2,
      pendingRank: 2,
    });
    const after = playWhot(state, "c2");
    expect(after.pendingDraw).toBe(4);
    expect(after.pendingRank).toBe(2);
    expect(after.hands[1]).toHaveLength(1);
    expect(after.turn).toBe(1);
  });

  it("a 5 cannot defend a Pick Two, and a 2 cannot defend a Pick Three", () => {
    const five = card("c5", "circle", 5);
    const two = card("c2", "circle", 2);
    expect(canPlayCard(game({ pendingDraw: 2, pendingRank: 2 }), five)).toBe(false);
    expect(canPlayCard(game({ pendingDraw: 3, pendingRank: 5 }), two)).toBe(false);
  });

  it("a Pick Three is worth three cards and the next player draws the whole penalty", () => {
    const state = game({
      hands: [[card("c5", "circle", 5), card("x", "cross", 9)], [card("o", "cross", 11)]],
    });
    const after = playWhot(state, "c5");
    expect(after.pendingDraw).toBe(3);
    const drawn = drawWhot({ ...after, turn: 1 });
    expect(drawn.hands[1]).toHaveLength(4);
    expect(drawn.pendingDraw).toBe(0);
  });

  it("a Whot card cannot cancel a penalty unless the house rule is agreed", () => {
    const hand = [card("w", null, 20)];
    const blocked = game({ hands: [hand, []], pendingDraw: 2, pendingRank: 2 });
    expect(playableCards(blocked)).toEqual([]);
    const agreed = game({
      hands: [hand, []],
      pendingDraw: 2,
      pendingRank: 2,
      whotBlocksPenalty: true,
    });
    expect(playableCards(agreed).map((item) => item.id)).toEqual(["w"]);
    const cancelled = playWhot(agreed, "w", "star");
    expect(cancelled.pendingDraw).toBe(0);
    expect(cancelled.pendingRank).toBeNull();
    expect(cancelled.shape).toBe("star");
  });
});
