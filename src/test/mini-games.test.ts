import { describe, expect, it } from "vitest";
import {
  bestTicTacToeMove,
  lineWinner,
  newTicTacToe,
  playTicTacToe,
  type TicTacToeState,
} from "@/lib/mini-games/tic-tac-toe";
import {
  bestDraughtsMove,
  legalDraughtsMoves,
  newDraughts,
  playDraughts,
  type DraughtsState,
} from "@/lib/mini-games/draughts";
import {
  BASE,
  FINISHED,
  legalTokenMoves,
  moveLudoToken,
  newLudo,
  rollLudo,
  type LudoState,
} from "@/lib/mini-games/ludo";
import {
  buildWhotDeck,
  newWhot,
  playWhot,
  playableCards,
  type WhotState,
} from "@/lib/mini-games/whot";

function squareOf(board: DraughtsState["board"], row: number, col: number) {
  return board[row]?.[col] ?? null;
}

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

describe("tic-tac-toe", () => {
  it("detects a row win and ends the game", () => {
    let state = newTicTacToe();
    for (const index of [0, 3, 1, 4, 2]) state = playTicTacToe(state, index);
    expect(state.winner).toBe("X");
    expect(lineWinner(state.board)).toBe("X");
  });

  it("ignores moves on taken squares", () => {
    const state = playTicTacToe(newTicTacToe(), 4);
    expect(playTicTacToe(state, 4)).toBe(state);
  });

  it("blocks a winning line when the computer can", () => {
    const state: TicTacToeState = {
      board: ["X", "X", null, "O", "O", null, null, null, null],
      turn: "O",
      winner: null,
    };
    expect(bestTicTacToeMove(state)).toBe(5);
  });

  it("never loses to the computer when the computer plays both sides", () => {
    let state = newTicTacToe();
    while (!state.winner) state = playTicTacToe(state, bestTicTacToeMove(state));
    expect(state.winner).toBe("draw");
  });
});

describe("draughts", () => {
  it("starts with seven opening moves for light", () => {
    expect(legalDraughtsMoves(newDraughts())).toHaveLength(7);
  });

  it("makes a capture mandatory", () => {
    const board = Array.from({ length: 8 }, () =>
      Array<DraughtsState["board"][number][number]>(8).fill(null),
    );
    board[5]![2] = { side: "light", king: false };
    board[4]![3] = { side: "dark", king: false };
    const state: DraughtsState = { board, turn: "light", quietPlies: 0, winner: null };
    const moves = legalDraughtsMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.captured).toEqual([4, 3]);
    const after = playDraughts(state, moves[0]!);
    expect(squareOf(after.board, 4, 3)).toBeNull();
    expect(squareOf(after.board, 3, 4)).toEqual({ side: "light", king: false });
  });

  it("promotes a man on the far row", () => {
    const board = Array.from({ length: 8 }, () =>
      Array<DraughtsState["board"][number][number]>(8).fill(null),
    );
    board[1]![2] = { side: "light", king: false };
    const state: DraughtsState = { board, turn: "light", quietPlies: 0, winner: null };
    const after = playDraughts(state, { from: [1, 2], to: [0, 1], captured: null });
    expect(squareOf(after.board, 0, 1)?.king).toBe(true);
  });

  it("plays a full computer game to an end", () => {
    let state = newDraughts();
    for (let ply = 0; ply < 300 && !state.winner; ply += 1) {
      const move = bestDraughtsMove(state);
      if (!move) break;
      state = playDraughts(state, move);
    }
    expect(state.winner).not.toBeNull();
  });
});

describe("ludo", () => {
  it("only a six takes a token out of base", () => {
    const state = rollLudo(newLudo(2), 3);
    expect(state.dice).toBeNull();
    expect(state.turn).toBe(1);
  });

  it("brings a token out on six and gives another roll", () => {
    let state: LudoState = rollLudo(newLudo(2), 6);
    expect(legalTokenMoves(state, 6)).toEqual([0, 1, 2, 3]);
    state = moveLudoToken(state, 0);
    expect(state.tokens[0]?.[0]).toBe(0);
    expect(state.turn).toBe(0);
    expect(state.dice).toBeNull();
  });

  it("sends an opponent back when landing on an unsafe shared square", () => {
    // Player 0 starts at loop square 0 and player 1 at 26. Progress 12 for player 0 is loop square 12,
    // which is not safe. Player 1 progress 38 is loop square (26 + 38) % 52 = 12, the same square.
    const state: LudoState = {
      playerCount: 2,
      tokens: [
        [10, BASE, BASE, BASE],
        [38, BASE, BASE, BASE],
      ],
      turn: 0,
      dice: 2,
      winner: null,
    };
    const after = moveLudoToken(state, 0);
    expect(after.tokens[0]?.[0]).toBe(12);
    expect(after.tokens[1]?.[0]).toBe(BASE);
  });

  it("does not send an opponent back on a safe square", () => {
    // Progress 13 for player 0 is loop square 13, a safe square. Player 1 progress 39 is also square 13.
    const state: LudoState = {
      playerCount: 2,
      tokens: [
        [10, BASE, BASE, BASE],
        [39, BASE, BASE, BASE],
      ],
      turn: 0,
      dice: 3,
      winner: null,
    };
    const after = moveLudoToken(state, 0);
    expect(after.tokens[0]?.[0]).toBe(13);
    expect(after.tokens[1]?.[0]).toBe(39);
  });

  it("needs an exact roll to finish", () => {
    const state: LudoState = {
      playerCount: 2,
      tokens: [
        [FINISHED - 2, BASE, BASE, BASE],
        [BASE, BASE, BASE, BASE],
      ],
      turn: 0,
      dice: 5,
      winner: null,
    };
    expect(legalTokenMoves(state, 5)).not.toContain(0);
  });
});

describe("whot", () => {
  it("deals five cards each from a 61-card deck", () => {
    const deck = buildWhotDeck(seeded(1));
    expect(deck).toHaveLength(61);
    const state = newWhot(3, seeded(1));
    expect(state.hands.map((hand) => hand.length)).toEqual([5, 5, 5]);
    expect(state.discard).toHaveLength(1);
  });

  it("only lets the player play a matching card or the Whot", () => {
    const state = newWhot(2, seeded(7));
    for (const card of playableCards(state)) {
      expect(
        card.rank === 20 || card.shape === state.shape || card.rank === state.discard[0]?.rank,
      ).toBe(true);
    }
  });

  it("requires a shape when a Whot card is played", () => {
    const base = newWhot(2, seeded(3));
    const whot = { id: "whot", shape: null, rank: 20 };
    const state: WhotState = {
      ...base,
      hands: [[whot, { id: "a", shape: "circle", rank: 1 }], base.hands[1] ?? []],
      turn: 0,
      pendingDraw: 0,
    };
    expect(playWhot(state, "whot")).toBe(state);
    const after = playWhot(state, "whot", "star");
    expect(after.shape).toBe("star");
    expect(after.turn).toBe(1);
  });

  it("makes the next player draw two after a 2", () => {
    const base = newWhot(2, seeded(5));
    const two = { id: "two", shape: "circle" as const, rank: 2 };
    const state: WhotState = {
      ...base,
      hands: [[two, { id: "keep", shape: "star", rank: 3 }], base.hands[1] ?? []],
      discard: [{ id: "top", shape: "circle", rank: 4 }],
      shape: "circle",
      turn: 0,
      pendingDraw: 0,
    };
    const after = playWhot(state, "two", undefined, seeded(9));
    expect(after.hands[1]?.length).toBe((base.hands[1]?.length ?? 0) + 2);
    expect(after.turn).toBe(0);
  });
});
