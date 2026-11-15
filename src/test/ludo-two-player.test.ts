import { describe, expect, it } from "vitest";
import {
  YARD_STEP,
  completeNoLegalMoves,
  createLudoGame,
  currentPlayerId,
  getLegalMoves,
  moveToken,
  rollDice,
  type LudoGame,
  type Seat,
} from "@/lib/mini-games/ludo-engine";

/** Naija Ludo two-player: each player owns two houses; turns alternate between the players. */
const seats: Seat[] = [
  { colour: "RED", playerId: "you" },
  { colour: "GREEN", playerId: "cpu-1" },
  { colour: "YELLOW", playerId: "you" },
  { colour: "BLUE", playerId: "cpu-1" },
];

function gameWith(pieces: Partial<LudoGame["pieces"]>, extra: Partial<LudoGame> = {}): LudoGame {
  const base = createLudoGame(seats);
  return {
    ...base,
    pieces: {
      RED: [YARD_STEP, YARD_STEP, YARD_STEP, YARD_STEP],
      GREEN: [YARD_STEP, YARD_STEP, YARD_STEP, YARD_STEP],
      YELLOW: [YARD_STEP, YARD_STEP, YARD_STEP, YARD_STEP],
      BLUE: [YARD_STEP, YARD_STEP, YARD_STEP, YARD_STEP],
      ...pieces,
    },
    ...extra,
  };
}

describe("two-player Ludo ownership and turns", () => {
  it("lets a player move a pawn of either of their two houses in one turn", () => {
    // Red and yellow both have a pawn on the track, so the player has a choice of houses.
    const game = gameWith({
      RED: [3, YARD_STEP, YARD_STEP, YARD_STEP],
      YELLOW: [5, YARD_STEP, YARD_STEP, YARD_STEP],
    });
    const rolled = {
      ...game,
      phase: "WAITING_FOR_MOVE" as const,
      dice: [2, 4] as const,
      used: [false, false] as [boolean, boolean],
    };
    const colours = new Set(getLegalMoves(rolled, "you").map((move) => move.colour));
    expect(colours).toEqual(new Set(["RED", "YELLOW"]));
  });

  it("never offers the computer a pawn of the player's houses, or the player the computer's", () => {
    const game = gameWith(
      { GREEN: [3, YARD_STEP, YARD_STEP, YARD_STEP], BLUE: [3, YARD_STEP, YARD_STEP, YARD_STEP] },
      {
        phase: "WAITING_FOR_MOVE",
        dice: [2, 4],
        used: [false, false],
      },
    );
    expect(currentPlayerId(game)).toBe("you");
    expect(getLegalMoves(game, "cpu-1")).toEqual([]);
    const colours = new Set(getLegalMoves(game, "you").map((move) => move.colour));
    expect(colours.has("GREEN")).toBe(false);
    expect(colours.has("BLUE")).toBe(false);
  });

  it("rejects a move of the other player's pawn, even from the computer's own turn", () => {
    const game = gameWith(
      { RED: [3, YARD_STEP, YARD_STEP, YARD_STEP] },
      {
        phase: "WAITING_FOR_MOVE",
        dice: [2, 4],
        used: [false, false],
      },
    );
    expect(moveToken(game, "cpu-1", "RED", 0).ok).toBe(false);
  });

  it("alternates turns between the two players, two seats each", () => {
    // Seat order is you, computer, you, computer. With nothing able to leave the yard (1 and 2),
    // every roll ends with no legal move and the turn passes to the next seat.
    let game = gameWith({});
    const order: string[] = [];
    for (let turn = 0; turn < 4; turn += 1) {
      const player = currentPlayerId(game);
      order.push(player);
      const rolled = rollDice(game, player, [1, 2]);
      expect(rolled.ok).toBe(true);
      if (!rolled.ok) return;
      expect(rolled.game.phase).toBe("NO_LEGAL_MOVES");
      const passed = completeNoLegalMoves(rolled.game, player);
      expect(passed.ok).toBe(true);
      if (!passed.ok) return;
      game = passed.game;
    }
    expect(order).toEqual(["you", "cpu-1", "you", "cpu-1"]);
  });
});
