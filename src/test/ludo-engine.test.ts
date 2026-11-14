import { describe, expect, it } from "vitest";
import {
  COLOURS,
  FINISH_STEP,
  NO_LEGAL_MOVES_DELAY_MS,
  SAFE_TILES,
  YARD_STEP,
  absoluteTile,
  completeNoLegalMoves,
  createLudoGame,
  getLegalMoves,
  moveToken,
  rollDice,
  timeoutAction,
  type Colour,
  type LudoGame,
  type LudoResult,
  type Pieces,
  type Seat,
} from "@/lib/mini-games/ludo-engine";

const yard = () => [YARD_STEP, YARD_STEP, YARD_STEP, YARD_STEP];
const seats2: Seat[] = [
  { colour: "RED" as const, playerId: "alice" },
  { colour: "GREEN" as const, playerId: "bob" },
];

function game(
  pieces: Partial<Record<Colour, number[]>>,
  options: Partial<LudoGame> = {},
): LudoGame {
  const base = createLudoGame(seats2);
  const merged: Pieces = {
    RED: pieces.RED ?? yard(),
    GREEN: pieces.GREEN ?? yard(),
    YELLOW: pieces.YELLOW ?? yard(),
    BLUE: pieces.BLUE ?? yard(),
  };
  return { ...base, pieces: merged, ...options };
}

function ok(result: LudoResult): Extract<LudoResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected success, got ${result.error}`);
  return result;
}

describe("LudoEngine board", () => {
  it("has four colours with safe tiles at each start and each star eight steps ahead", () => {
    expect(COLOURS).toEqual(["RED", "GREEN", "YELLOW", "BLUE"]);
    expect(SAFE_TILES).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
    expect(absoluteTile("RED", 0)).toBe(0);
    expect(absoluteTile("GREEN", 0)).toBe(13);
    expect(absoluteTile("BLUE", 13)).toBe(0);
  });
});

describe("LudoEngine turns and dice", () => {
  it("only a six takes a token out of the yard, onto its start tile", () => {
    const start = game({});
    expect(getLegalMoves(start, "alice", 5)).toEqual([]);
    const exit = ok(rollDice(start, "alice", 6));
    expect(exit.game.phase).toBe("WAITING_FOR_MOVE");
    const moved = ok(moveToken(exit.game, "alice", "RED", 2));
    expect(moved.game.pieces.RED[2]).toBe(0);
    expect(moved.events.map((event) => event.type)).toContain("BONUS_ROLL");
  });

  it("rejects rolls and moves from the wrong player or phase", () => {
    const start = game({});
    expect(rollDice(start, "bob", 3)).toEqual({ ok: false, error: "INVALID_TURN" });
    expect(rollDice(start, "alice", 9)).toEqual({ ok: false, error: "INVALID_DICE" });
    const rolled = ok(rollDice(game({ RED: [4, YARD_STEP, YARD_STEP, YARD_STEP] }), "alice", 2));
    expect(moveToken(rolled.game, "bob", "GREEN", 0)).toEqual({ ok: false, error: "INVALID_TURN" });
    expect(rollDice(rolled.game, "alice", 2)).toEqual({ ok: false, error: "INVALID_PHASE" });
    expect(moveToken(rolled.game, "alice", "RED", 1)).toEqual({ ok: false, error: "ILLEGAL_MOVE" });
  });

  it("emits NO_LEGAL_MOVES and passes the turn after the delay", () => {
    const rolled = ok(rollDice(game({}), "alice", 3));
    expect(rolled.game.phase).toBe("NO_LEGAL_MOVES");
    expect(rolled.events.map((event) => event.type)).toContain("NO_LEGAL_MOVES");
    expect(NO_LEGAL_MOVES_DELAY_MS).toBe(1200);
    const passed = ok(completeNoLegalMoves(rolled.game, "alice"));
    expect(passed.game.turnIndex).toBe(1);
    expect(passed.game.phase).toBe("WAITING_FOR_ROLL");
  });

  it("forfeits on the third consecutive six without moving a token", () => {
    let state = game({ RED: [0, YARD_STEP, YARD_STEP, YARD_STEP] });
    state = ok(rollDice(state, "alice", 6)).game;
    state = ok(moveToken(state, "alice", "RED", 0)).game;
    expect(state.consecutiveSixes).toBe(1);
    state = ok(rollDice(state, "alice", 6)).game;
    state = ok(moveToken(state, "alice", "RED", 0)).game;
    const third = ok(rollDice(state, "alice", 6));
    expect(third.events.map((event) => event.type)).toContain("TRIPLE_SIX_FORFEIT");
    expect(third.game.pieces.RED[0]).toBe(12);
    expect(third.game.turnIndex).toBe(1);
    expect(third.game.consecutiveSixes).toBe(0);
  });
});

describe("LudoEngine captures, stacks and finishing", () => {
  it("captures a lone opponent on an unsafe tile, sends it to the yard and gives a bonus roll", () => {
    // GREEN step 0 is absolute tile 13 (safe). RED step 14 is absolute tile 14, which is not safe.
    // GREEN step 1 is absolute tile 14: a lone GREEN token there is the victim.
    const state = game(
      { RED: [13, YARD_STEP, YARD_STEP, YARD_STEP], GREEN: [1, YARD_STEP, YARD_STEP, YARD_STEP] },
      { lastDiceValue: 1, phase: "WAITING_FOR_MOVE" },
    );
    const result = ok(moveToken(state, "alice", "RED", 0));
    expect(result.game.pieces.GREEN[0]).toBe(YARD_STEP);
    expect(result.events.map((event) => event.type)).toContain("CAPTURED");
    expect(result.events.map((event) => event.type)).toContain("BONUS_ROLL");
    expect(result.game.turnIndex).toBe(0);
  });

  it("never captures on a safe tile", () => {
    // RED lands on tile 8 (a star). GREEN has a token on tile 8 at step 47.
    const state = game(
      { RED: [7, YARD_STEP, YARD_STEP, YARD_STEP], GREEN: [47, YARD_STEP, YARD_STEP, YARD_STEP] },
      { lastDiceValue: 1, phase: "WAITING_FOR_MOVE" },
    );
    const result = ok(moveToken(state, "alice", "RED", 0));
    expect(result.game.pieces.GREEN[0]).toBe(47);
    expect(result.events.map((event) => event.type)).not.toContain("CAPTURED");
  });

  it("a stack of two tokens cannot be landed on, but can be passed over", () => {
    // GREEN steps 1 on two tokens stack on tile 14. RED at step 12 lands on tile 14 with a 2: blocked.
    const state = game(
      { RED: [12, YARD_STEP, YARD_STEP, YARD_STEP], GREEN: [1, 1, YARD_STEP, YARD_STEP] },
      { lastDiceValue: 2, phase: "WAITING_FOR_MOVE" },
    );
    expect(getLegalMoves(state, "alice", 2).some((move) => move.token === 0)).toBe(false);
    // A 3 from step 12 jumps over tile 14 and lands on tile 15: allowed.
    expect(getLegalMoves(state, "alice", 3).some((move) => move.token === 0)).toBe(true);
  });

  it("a stack of own tokens is safe and does not block", () => {
    const state = game(
      { RED: [5, 5, YARD_STEP, YARD_STEP] },
      { lastDiceValue: 3, phase: "WAITING_FOR_MOVE" },
    );
    expect(getLegalMoves(state, "alice", 3).length).toBe(2);
  });

  it("needs an exact roll to reach the finish", () => {
    const state = game({ RED: [FINISH_STEP - 2, YARD_STEP, YARD_STEP, YARD_STEP] });
    expect(getLegalMoves(state, "alice", 5)).toEqual([]);
    const finished = ok(rollDice(state, "alice", 2));
    const moved = ok(moveToken(finished.game, "alice", "RED", 0));
    expect(moved.game.pieces.RED[0]).toBe(FINISH_STEP);
    expect(moved.events.map((event) => event.type)).toContain("BONUS_ROLL");
  });

  it("ends the game when every token of a player has finished", () => {
    const state = game({ RED: [FINISH_STEP, FINISH_STEP, FINISH_STEP, 54] });
    const rolled = ok(rollDice(state, "alice", 3));
    const finished = ok(moveToken(rolled.game, "alice", "RED", 3));
    expect(finished.game.phase).toBe("GAME_OVER");
    expect(finished.game.winnerId).toBe("alice");
    expect(finished.events.map((event) => event.type)).toContain("GAME_OVER");
    expect(rollDice(finished.game, "alice", 1)).toEqual({ ok: false, error: "INVALID_PHASE" });
  });
});

describe("LudoEngine determinism and timeouts", () => {
  it("is deterministic and never mutates its input", () => {
    const start = game({});
    const snapshot = JSON.stringify(start);
    const a = rollDice(start, "alice", 6);
    const b = rollDice(start, "alice", 6);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("a timeout rolls for a waiting player and plays a random legal token", () => {
    const rolled = timeoutAction(game({}), "alice", () => 0.99);
    expect(ok(rolled).game.lastDiceValue).toBe(6);
    const moved = timeoutAction(ok(rolled).game, "alice", () => 0);
    expect(ok(moved).game.pieces.RED).toContain(0);
  });

  it("runs a full random game to a winner for every seat count it supports", () => {
    const seats3: Seat[] = [...seats2, { colour: "YELLOW", playerId: "cara" }];
    const seats4: Seat[] = [...seats3, { colour: "BLUE", playerId: "dan" }];
    for (const seats of [seats2, seats3, seats4]) {
      for (let seed = 1; seed <= 20; seed += 1) {
        let state = createLudoGame(seats);
        let value = seed;
        const random = () => {
          value = (value * 1103515245 + 12345) % 2147483648;
          return value / 2147483648;
        };
        let steps = 0;
        while (state.phase !== "GAME_OVER" && steps < 50_000) {
          const player = seats[state.turnIndex]?.playerId ?? "";
          const result = timeoutAction(state, player, random);
          if (!result.ok) throw new Error(`Stuck: ${result.error}`);
          state = result.game;
          steps += 1;
        }
        expect(state.phase).toBe("GAME_OVER");
      }
    }
  });
});
