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
  type DiceValues,
  type LudoGame,
  type LudoResult,
  type Pieces,
  type Seat,
} from "@/lib/mini-games/ludo-engine";

const yard = () => [YARD_STEP, YARD_STEP, YARD_STEP, YARD_STEP];
const seats2: Seat[] = [
  { colour: "RED", playerId: "alice" },
  { colour: "GREEN", playerId: "bob" },
];

/** A game where `alice` is on the move with the given dice already rolled. */
function rolled(pieces: Partial<Record<Colour, number[]>>, dice: DiceValues): LudoGame {
  const base = createLudoGame(seats2);
  const merged: Pieces = {
    RED: pieces.RED ?? yard(),
    GREEN: pieces.GREEN ?? yard(),
    YELLOW: pieces.YELLOW ?? yard(),
    BLUE: pieces.BLUE ?? yard(),
  };
  return {
    ...base,
    pieces: merged,
    phase: "WAITING_FOR_MOVE",
    dice,
    used: [false, false],
    bonus: dice.includes(6) ? "SIX" : null,
  };
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

describe("LudoEngine two dice", () => {
  it("only a six takes a token out of the yard, onto its start tile", () => {
    const start = createLudoGame(seats2);
    expect(rollDice(start, "bob", [5, 5])).toEqual({ ok: false, error: "INVALID_TURN" });
    const exit = ok(rollDice(start, "alice", [6, 2]));
    expect(exit.game.phase).toBe("WAITING_FOR_MOVE");
    const moved = ok(moveToken(exit.game, "alice", "RED", 2, 0));
    expect(moved.game.pieces.RED[2]).toBe(0);
    expect(moved.game.used).toEqual([true, false]);
  });

  it("plays the two dice in either order, one token each", () => {
    let state = rolled({ RED: [0, 5, YARD_STEP, YARD_STEP] }, [2, 3]);
    state = ok(moveToken(state, "alice", "RED", 0, 1)).game;
    expect(state.pieces.RED[0]).toBe(3);
    expect(state.used).toEqual([false, true]);
    state = ok(moveToken(state, "alice", "RED", 1, 0)).game;
    expect(state.pieces.RED[1]).toBe(7);
    expect(state.turnIndex).toBe(1);
    expect(state.phase).toBe("WAITING_FOR_ROLL");
  });

  it("rejects wrong players, bad dice and an already played die", () => {
    const start = createLudoGame(seats2);
    expect(rollDice(start, "alice", [9, 1])).toEqual({ ok: false, error: "INVALID_DICE" });
    const state = rolled({ RED: [4, YARD_STEP, YARD_STEP, YARD_STEP] }, [2, 3]);
    expect(moveToken(state, "bob", "GREEN", 0)).toEqual({ ok: false, error: "INVALID_TURN" });
    const once = ok(moveToken(state, "alice", "RED", 0, 0)).game;
    expect(moveToken(once, "alice", "RED", 0, 0)).toEqual({ ok: false, error: "ILLEGAL_MOVE" });
    expect(rollDice(once, "alice", [1, 1])).toEqual({ ok: false, error: "INVALID_PHASE" });
  });

  it("emits NO_LEGAL_MOVES and passes the turn after the delay when neither die fits", () => {
    const result = ok(rollDice(createLudoGame(seats2), "alice", [2, 3]));
    expect(result.game.phase).toBe("NO_LEGAL_MOVES");
    expect(result.events.map((event) => event.type)).toContain("NO_LEGAL_MOVES");
    expect(NO_LEGAL_MOVES_DELAY_MS).toBe(1200);
    const passed = ok(completeNoLegalMoves(result.game, "alice"));
    expect(passed.game.turnIndex).toBe(1);
    expect(passed.game.phase).toBe("WAITING_FOR_ROLL");
  });

  it("a roll with a six gives a bonus roll once the dice are spent", () => {
    let state = rolled({ RED: [0, YARD_STEP, YARD_STEP, YARD_STEP] }, [6, 1]);
    state = ok(moveToken(state, "alice", "RED", 0, 1)).game;
    expect(state.turnIndex).toBe(0);
    expect(state.phase).toBe("WAITING_FOR_MOVE");
    state = ok(moveToken(state, "alice", "RED", 0, 0)).game;
    expect(state.turnIndex).toBe(0);
    expect(state.phase).toBe("WAITING_FOR_ROLL");
  });

  it("a capture earns a bonus roll", () => {
    // RED step 14 is absolute tile 14. GREEN step 1 is also tile 14: the lone GREEN token is captured.
    const state = rolled(
      { RED: [12, YARD_STEP, YARD_STEP, YARD_STEP], GREEN: [1, YARD_STEP, YARD_STEP, YARD_STEP] },
      [2, 6],
    );
    const hit = ok(moveToken(state, "alice", "RED", 0, 0));
    expect(hit.game.pieces.GREEN[0]).toBe(YARD_STEP);
    expect(hit.events.map((event) => event.type)).toContain("CAPTURED");
    expect(hit.game.bonus).toBe("SIX");
  });

  it("forfeits the turn on the third roll in a row with a six, without moving", () => {
    let state = createLudoGame(seats2);
    // Two rolls that each show a six. Each roll plays the six out of the yard, then the other die.
    for (let round = 0; round < 2; round += 1) {
      state = ok(rollDice(state, "alice", [6, 1])).game;
      state = ok(moveToken(state, "alice", "RED", round, 0)).game;
      state = ok(moveToken(state, "alice", "RED", 0, 1)).game;
    }
    expect(state.consecutiveSixRolls).toBe(2);
    const forfeit = ok(rollDice(state, "alice", [6, 4]));
    expect(forfeit.events.map((event) => event.type)).toContain("TRIPLE_SIX_FORFEIT");
    expect(forfeit.game.pieces.RED).toEqual(state.pieces.RED);
    expect(forfeit.game.turnIndex).toBe(1);
    expect(forfeit.game.consecutiveSixRolls).toBe(0);
  });
});

describe("LudoEngine captures, stacks and finishing", () => {
  it("never captures on a safe tile", () => {
    // RED lands on tile 8 (a star). GREEN has a token on tile 8 at step 47.
    const state = rolled(
      { RED: [7, YARD_STEP, YARD_STEP, YARD_STEP], GREEN: [47, YARD_STEP, YARD_STEP, YARD_STEP] },
      [1, 2],
    );
    const result = ok(moveToken(state, "alice", "RED", 0, 0));
    expect(result.game.pieces.GREEN[0]).toBe(47);
    expect(result.events.map((event) => event.type)).not.toContain("CAPTURED");
  });

  it("a stack of two tokens cannot be landed on, but can be passed over", () => {
    // GREEN steps 1 on two tokens stack on tile 14. RED at step 12 lands on tile 14 with a 2: blocked.
    const state = rolled(
      { RED: [12, YARD_STEP, YARD_STEP, YARD_STEP], GREEN: [1, 1, YARD_STEP, YARD_STEP] },
      [2, 3],
    );
    expect(getLegalMoves(state, "alice").some((move) => move.token === 0 && move.die === 0)).toBe(
      false,
    );
    // A 3 from step 12 jumps over tile 14 and lands on tile 15: allowed.
    expect(getLegalMoves(state, "alice").some((move) => move.token === 0 && move.die === 1)).toBe(
      true,
    );
  });

  it("a stack of own tokens is safe and does not block", () => {
    const state = rolled({ RED: [5, 5, YARD_STEP, YARD_STEP] }, [3, 1]);
    expect(getLegalMoves(state, "alice").filter((move) => move.die === 0).length).toBe(2);
  });

  it("needs an exact roll to reach the finish", () => {
    const state = rolled({ RED: [FINISH_STEP - 2, YARD_STEP, YARD_STEP, YARD_STEP] }, [5, 1]);
    expect(getLegalMoves(state, "alice").some((move) => move.die === 0 && move.token === 0)).toBe(
      false,
    );
    const finished = ok(moveToken(state, "alice", "RED", 0, 1)).game;
    expect(finished.pieces.RED[0]).toBe(FINISH_STEP - 1);
  });

  it("ends the game when every token of a player has finished", () => {
    const state = rolled({ RED: [FINISH_STEP, FINISH_STEP, FINISH_STEP, 54] }, [3, 1]);
    const done = ok(moveToken(state, "alice", "RED", 3, 0));
    expect(done.game.phase).toBe("GAME_OVER");
    expect(done.game.winnerId).toBe("alice");
    expect(done.events.map((event) => event.type)).toContain("GAME_OVER");
    expect(rollDice(done.game, "alice", [1, 1])).toEqual({ ok: false, error: "INVALID_PHASE" });
  });
});

describe("LudoEngine determinism and timeouts", () => {
  it("is deterministic and never mutates its input", () => {
    const start = createLudoGame(seats2);
    const snapshot = JSON.stringify(start);
    expect(JSON.stringify(rollDice(start, "alice", [6, 2]))).toBe(
      JSON.stringify(rollDice(start, "alice", [6, 2])),
    );
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("a timeout rolls two dice for a waiting player, then plays a legal move", () => {
    const rolledNow = ok(timeoutAction(createLudoGame(seats2), "alice", () => 0.99));
    expect(rolledNow.game.dice).toEqual([6, 6]);
    const moved = ok(timeoutAction(rolledNow.game, "alice", () => 0));
    expect(moved.game.pieces.RED.some((step) => step === 0)).toBe(true);
  });

  it("runs full random games to a winner for every seat count it supports", () => {
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
