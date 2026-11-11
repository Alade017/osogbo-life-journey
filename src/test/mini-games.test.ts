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
  bestWhotCard,
  buildWhotDeck,
  drawWhot,
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
    expect(moves[0]?.captured).toEqual([[4, 3]]);
    const after = playDraughts(state, moves[0]!);
    expect(squareOf(after.board, 4, 3)).toBeNull();
    expect(squareOf(after.board, 3, 4)).toEqual({ side: "light", king: false });
  });

  it("keeps a capture sequence going until no jump is left", () => {
    const board = Array.from({ length: 8 }, () =>
      Array<DraughtsState["board"][number][number]>(8).fill(null),
    );
    board[6]![1] = { side: "light", king: false };
    board[5]![2] = { side: "dark", king: false };
    board[3]![4] = { side: "dark", king: false };
    const state: DraughtsState = { board, turn: "light", quietPlies: 0, winner: null };
    const moves = legalDraughtsMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.path).toEqual([
      [6, 1],
      [4, 3],
      [2, 5],
    ]);
    expect(moves[0]?.captured).toEqual([
      [5, 2],
      [3, 4],
    ]);
    const after = playDraughts(state, moves[0]!);
    expect(squareOf(after.board, 2, 5)).toEqual({ side: "light", king: false });
    expect(squareOf(after.board, 5, 2)).toBeNull();
    expect(squareOf(after.board, 3, 4)).toBeNull();
  });

  it("promotes a man on the far row", () => {
    const board = Array.from({ length: 8 }, () =>
      Array<DraughtsState["board"][number][number]>(8).fill(null),
    );
    board[1]![2] = { side: "light", king: false };
    const state: DraughtsState = { board, turn: "light", quietPlies: 0, winner: null };
    const after = playDraughts(state, {
      from: [1, 2],
      to: [0, 1],
      path: [
        [1, 2],
        [0, 1],
      ],
      captured: [],
    });
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

describe("whot", () => {
  it("deals five cards each from a 61-card deck", () => {
    const deck = buildWhotDeck(seeded(1));
    expect(deck).toHaveLength(54);
    const state = newWhot(3, seeded(1));
    expect(state.hands.map((hand) => hand.length)).toEqual([6, 6, 6]);
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

  it("starts a Pick Two penalty that the next player must defend or draw", () => {
    const base = newWhot(2, seeded(5));
    const two = { id: "two", shape: "circle" as const, rank: 2 };
    const state: WhotState = {
      ...base,
      hands: [[two, { id: "keep", shape: "star", rank: 3 }], base.hands[1] ?? []],
      discard: [{ id: "top", shape: "circle", rank: 4 }],
      shape: "circle",
      turn: 0,
      pendingDraw: 0,
      pendingRank: null,
    };
    const after = playWhot(state, "two", undefined, seeded(9));
    expect(after.turn).toBe(1);
    expect(after.pendingDraw).toBe(2);
    const drawn = drawWhot(after, seeded(9));
    expect(drawn.hands[1]?.length).toBe((base.hands[1]?.length ?? 0) + 2);
    expect(drawn.turn).toBe(0);
    expect(drawn.pendingDraw).toBe(0);
  });

  it("lets the next player defend a Pick Two with another Pick Two and stack the penalty", () => {
    const base = newWhot(2, seeded(5));
    const defender = { id: "two-b", shape: "star" as const, rank: 2 };
    const state: WhotState = {
      ...base,
      hands: [
        [{ id: "a", shape: "circle", rank: 1 }],
        [defender, { id: "spare", shape: "star", rank: 3 }],
      ],
      discard: [{ id: "top", shape: "circle", rank: 2 }],
      shape: "circle",
      turn: 1,
      pendingDraw: 2,
      pendingRank: 2,
    };
    const after = playWhot(state, "two-b", undefined, seeded(3));
    expect(after.pendingDraw).toBe(4);
    expect(after.turn).toBe(0);
  });

  it("makes Hold On keep the turn with the same player", () => {
    const base = newWhot(2, seeded(11));
    const hold = { id: "hold", shape: "circle" as const, rank: 1 };
    const state: WhotState = {
      ...base,
      hands: [[hold, { id: "keep", shape: "star", rank: 3 }], base.hands[1] ?? []],
      discard: [{ id: "top", shape: "circle", rank: 4 }],
      shape: "circle",
      turn: 0,
      pendingDraw: 0,
      pendingRank: null,
    };
    expect(playWhot(state, "hold", undefined, seeded(2)).turn).toBe(0);
  });
});

describe("computer games finish", () => {
  it("plays Whot to a winner for 2 to 4 players", () => {
    for (let players = 2; players <= 4; players += 1) {
      for (let seed = 1; seed <= 15; seed += 1) {
        const rng = seeded(seed * 17 + players);
        let state = newWhot(players, rng);
        let steps = 0;
        while (state.winner === null && steps < 4000) {
          const choice = bestWhotCard(state);
          state = choice
            ? playWhot(state, choice.cardId, choice.shape ?? undefined, rng)
            : drawWhot(state, rng);
          steps += 1;
        }
        expect(state.winner).not.toBeNull();
      }
    }
  });
});
