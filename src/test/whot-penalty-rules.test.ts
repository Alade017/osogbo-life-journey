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
  it("a 2 defends a Pick Two and the penalty does not stack", () => {
    const state = game({
      hands: [[card("c2", "circle", 2), card("x", "cross", 9)], [card("o", "cross", 11)]],
      pendingDraw: 2,
      pendingRank: 2,
    });
    const after = playWhot(state, "c2");
    expect(after.pendingDraw).toBe(2);
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

  it("a Whot card can never cancel a running penalty", () => {
    const hand = [card("w", null, 20), card("c2", "circle", 2)];
    const state = game({ hands: [hand, []], pendingDraw: 2, pendingRank: 2 });
    expect(playableCards(state).map((item) => item.id)).toEqual(["c2"]);
    expect(playWhot(state, "w", "star")).toBe(state);
    const defended = playWhot(state, "c2");
    expect(defended.pendingDraw).toBe(2);
    expect(defended.pendingRank).toBe(2);
  });

  it("a Whot card still picks the shape when no penalty is running", () => {
    const state = game({ hands: [[card("w", null, 20)], []] });
    const after = playWhot(state, "w", "star");
    expect(after.shape).toBe("star");
    expect(after.pendingDraw).toBe(0);
  });

  it("a player cannot finish the game on a 1 (Hold On) and must play on", () => {
    const lastOne = game({ hands: [[card("c1", "circle", 1)], [card("o", "cross", 11)]] });
    expect(playableCards(lastOne)).toEqual([]);
    expect(playWhot(lastOne, "c1")).toBe(lastOne);
    const withMore = game({
      hands: [[card("c1", "circle", 1), card("c3", "circle", 3)], [card("o", "cross", 11)]],
    });
    const after = playWhot(withMore, "c1");
    expect(after.winner).toBeNull();
    expect(after.turn).toBe(0);
    const finished = playWhot(after, "c3");
    expect(finished.winner).toBe(0);
  });
});
