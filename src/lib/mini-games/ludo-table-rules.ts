/**
 * Server-side rules for a Ludo stake table. Pure: the server route loads the private game, applies one
 * action here, and stores the result. Dice are supplied by the server, never by a player. A seat may act
 * only on its own turn, must roll before moving, and may move only what the rolled dice allow.
 */
import {
  legalMoves,
  moveLudoSeed,
  rollLudo,
  sameMove,
  type LudoMove,
  type LudoState,
} from "./ludo";

export type LudoAction =
  { kind: "roll"; dice: [number, number] } | { kind: "move"; move: LudoMove };

export type LudoRuleCode =
  "GAME_OVER" | "NOT_YOUR_TURN" | "ALREADY_ROLLED" | "ROLL_FIRST" | "MOVE_NOT_LEGAL";

export type LudoRuleResult = { ok: true; state: LudoState } | { ok: false; code: LudoRuleCode };

/** Applies one action for the seat (1 or 2). Seat 1 is side 0 of the game, seat 2 is side 1. */
export function applyLudoAction(
  state: LudoState,
  seat: number,
  action: LudoAction,
): LudoRuleResult {
  if (state.winner !== null) return { ok: false, code: "GAME_OVER" };
  if (state.turn !== seat - 1) return { ok: false, code: "NOT_YOUR_TURN" };

  if (action.kind === "roll") {
    if (state.pending !== null) return { ok: false, code: "ALREADY_ROLLED" };
    const [first, second] = action.dice;
    return { ok: true, state: rollLudo(state, first, second) };
  }

  if (state.pending === null) return { ok: false, code: "ROLL_FIRST" };
  const allowed = legalMoves(state).some((legal) => sameMove(legal, action.move));
  if (!allowed) return { ok: false, code: "MOVE_NOT_LEGAL" };
  return { ok: true, state: moveLudoSeed(state, action.move) };
}
