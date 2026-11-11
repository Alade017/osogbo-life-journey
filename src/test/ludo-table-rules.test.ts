import { describe, expect, it } from "vitest";
import { legalMoves, newLudo, type LudoMove, type LudoState } from "@/lib/mini-games/ludo";
import { applyLudoAction, type LudoAction } from "@/lib/mini-games/ludo-table-rules";

function fail(state: LudoState, seat: number, kind: "roll" | "move", move?: unknown) {
  const action: LudoAction =
    kind === "roll" ? { kind: "roll", dice: [6, 2] } : { kind: "move", move: move as LudoMove };
  return applyLudoAction(state, seat, action);
}

describe("ludo table rules", () => {
  it("only the seat whose turn it is may roll", () => {
    const result = fail(newLudo(1), 2, "roll");
    expect(result).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("the server's dice start the turn, and a second roll is refused", () => {
    const first = applyLudoAction(newLudo(1), 1, { kind: "roll", dice: [6, 3] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.pending).toEqual([6, 3]);
    expect(fail(first.state, 1, "roll")).toEqual({ ok: false, code: "ALREADY_ROLLED" });
  });

  it("a move before rolling is refused", () => {
    const move = { house: 0, token: 0, from: -1, to: 0, uses: [0] };
    expect(fail(newLudo(1), 1, "move", move)).toEqual({ ok: false, code: "ROLL_FIRST" });
  });

  it("a move the dice do not allow is refused and nothing changes", () => {
    const rolled = applyLudoAction(newLudo(1), 1, { kind: "roll", dice: [6, 3] });
    if (!rolled.ok) throw new Error("roll should succeed");
    const forged = { house: 2, token: 0, from: -1, to: 0, uses: [0] };
    expect(fail(rolled.state, 1, "move", forged)).toEqual({ ok: false, code: "MOVE_NOT_LEGAL" });
  });

  it("a legal move is applied for the seat that rolled", () => {
    const rolled = applyLudoAction(newLudo(1), 1, { kind: "roll", dice: [6, 3] });
    if (!rolled.ok) throw new Error("roll should succeed");
    const move = legalMoves(rolled.state)[0]!;
    const moved = applyLudoAction(rolled.state, 1, { kind: "move", move });
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.state.seeds[0]?.[move.token]).toBe(move.to);
  });

  it("nothing can be played once the game is won", () => {
    const won = { ...newLudo(1), winner: 0 };
    expect(applyLudoAction(won, 1, { kind: "roll", dice: [6, 6] })).toEqual({
      ok: false,
      code: "GAME_OVER",
    });
  });
});
