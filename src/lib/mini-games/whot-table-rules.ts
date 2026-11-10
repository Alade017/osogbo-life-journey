/**
 * Server-side rules for a Whot stake table. Pure: the server route loads the private game, applies one
 * action here, and stores the result. A seat may act only on its own turn, a card must be playable, a Whot
 * card needs a valid shape, and a player may draw only when no card can be played.
 */
import {
  canPlayCard,
  drawWhot,
  playableCards,
  playWhot,
  SHAPES,
  WHOT_RANK,
  type Shape,
  type WhotState,
} from "./whot";

export type WhotAction = { kind: "play"; cardId: string; shape?: Shape } | { kind: "draw" };

export type WhotRuleCode =
  | "GAME_OVER"
  | "NOT_YOUR_TURN"
  | "CARD_NOT_PLAYABLE"
  | "SHAPE_REQUIRED"
  | "SHAPE_INVALID"
  | "CAN_STILL_PLAY";

export type WhotRuleResult = { ok: true; state: WhotState } | { ok: false; code: WhotRuleCode };

/** Applies one action for the seat (1 or 2). Seat 1 is the first player in the game's turn order. */
export function applyWhotAction(
  state: WhotState,
  seat: number,
  action: WhotAction,
): WhotRuleResult {
  if (state.winner !== null) return { ok: false, code: "GAME_OVER" };
  if (state.turn !== seat - 1) return { ok: false, code: "NOT_YOUR_TURN" };

  if (action.kind === "draw") {
    if (playableCards(state).length > 0) return { ok: false, code: "CAN_STILL_PLAY" };
    return { ok: true, state: drawWhot(state) };
  }

  const card = state.hands[state.turn]?.find((item) => item.id === action.cardId);
  if (!card || !canPlayCard(state, card)) return { ok: false, code: "CARD_NOT_PLAYABLE" };
  if (card.rank === WHOT_RANK) {
    if (!action.shape) return { ok: false, code: "SHAPE_REQUIRED" };
    if (!SHAPES.includes(action.shape)) return { ok: false, code: "SHAPE_INVALID" };
  }
  const next = playWhot(state, action.cardId, action.shape);
  if (next === state) return { ok: false, code: "CARD_NOT_PLAYABLE" };
  return { ok: true, state: next };
}
