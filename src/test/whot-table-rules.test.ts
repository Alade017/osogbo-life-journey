import { describe, expect, it } from "vitest";
import { applyWhotAction } from "@/lib/mini-games/whot-table-rules";
import type { Card, WhotState } from "@/lib/mini-games/whot";

const card = (id: string, shape: Card["shape"], rank: number): Card => ({ id, shape, rank });

function table(overrides: Partial<WhotState> = {}): WhotState {
  return {
    playerCount: 2,
    hands: [
      [card("a1", "circle", 3), card("a2", "star", 9)],
      [card("b1", "cross", 7), card("b2", "square", 12)],
    ],
    stock: [card("s1", "triangle", 1), card("s2", "cross", 4)],
    discard: [card("d1", "circle", 5)],
    shape: "circle",
    turn: 0,
    pendingDraw: 0,
    pendingRank: null,
    winner: null,
    ...overrides,
  };
}

describe("Whot table rules", () => {
  it("lets the seat whose turn it is play a matching card", () => {
    const result = applyWhotAction(table(), 1, { kind: "play", cardId: "a1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.discard.at(-1)?.id).toBe("a1");
    expect(result.state.turn).not.toBe(0);
  });

  it("refuses a move from the seat that is not on turn", () => {
    expect(applyWhotAction(table(), 2, { kind: "play", cardId: "b1" })).toEqual({
      ok: false,
      code: "NOT_YOUR_TURN",
    });
  });

  it("refuses a card that matches neither shape nor rank", () => {
    expect(applyWhotAction(table(), 1, { kind: "play", cardId: "a2" })).toEqual({
      ok: false,
      code: "CARD_NOT_PLAYABLE",
    });
  });

  it("does not let a player draw while a card in hand can be played", () => {
    expect(applyWhotAction(table(), 1, { kind: "draw" })).toEqual({
      ok: false,
      code: "CAN_STILL_PLAY",
    });
  });

  it("allows a draw when nothing in hand matches", () => {
    const state = table({
      hands: [[card("a2", "star", 9)], [card("b1", "cross", 7)]],
    });
    const result = applyWhotAction(state, 1, { kind: "draw" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands[0]).toHaveLength(2);
  });

  it("requires a shape when a Whot card is played", () => {
    const state = table({ hands: [[card("w", null, 20)], [card("b1", "cross", 7)]] });
    expect(applyWhotAction(state, 1, { kind: "play", cardId: "w" })).toEqual({
      ok: false,
      code: "SHAPE_REQUIRED",
    });
  });

  it("refuses a shape that is not in the deck", () => {
    const state = table({ hands: [[card("w", null, 20)], [card("b1", "cross", 7)]] });
    const result = applyWhotAction(state, 1, {
      kind: "play",
      cardId: "w",
      shape: "moon" as never,
    });
    expect(result).toEqual({ ok: false, code: "SHAPE_INVALID" });
  });

  it("ends the game when the last card is played", () => {
    const state = table({ hands: [[card("a1", "circle", 3)], [card("b1", "cross", 7)]] });
    const result = applyWhotAction(state, 1, { kind: "play", cardId: "a1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe(0);
  });

  it("refuses any action after the game is over", () => {
    const state = table({ winner: 0 });
    expect(applyWhotAction(state, 1, { kind: "draw" })).toEqual({ ok: false, code: "GAME_OVER" });
  });
});
