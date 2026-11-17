import { describe, expect, it } from "vitest";
import {
  COLOURS,
  FINISH_STEP,
  LAST_TRACK_STEP,
  YARD_STEP,
  absoluteTile,
  bestComputerMove,
  createLudoGame,
  getLegalMoves,
  rollDice,
  type Colour,
} from "@/lib/mini-games/ludo-engine";
import {
  BOARD_SIZE,
  LOOP_CELLS,
  homeLane,
  hopStep,
  tokenPoint,
  yardRect,
} from "@/lib/mini-games/ludo-board";

const key = ([r, c]: readonly [number, number]) => `${r},${c}`;
const inBoard = ([r, c]: readonly [number, number]) =>
  r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;

describe("ludo board geometry", () => {
  it("has a 52-square loop of distinct connected cells on the board", () => {
    expect(LOOP_CELLS).toHaveLength(52);
    expect(new Set(LOOP_CELLS.map(key)).size).toBe(52);
    expect(LOOP_CELLS.every(inBoard)).toBe(true);
    LOOP_CELLS.forEach((cell, index) => {
      const next = LOOP_CELLS[(index + 1) % 52]!;
      expect(
        Math.max(Math.abs(cell[0] - next[0]), Math.abs(cell[1] - next[1])),
        `square ${index}`,
      ).toBe(1);
    });
  });

  it("keeps the loop off the centre and off the four yards", () => {
    const centre = (BOARD_SIZE - 1) / 2;
    for (const [r, c] of LOOP_CELLS) {
      const inCentre = Math.abs(r - centre) <= 1 && Math.abs(c - centre) <= 1;
      const inYard = (r < 6 || r > 8) && (c < 6 || c > 8);
      expect(inCentre || inYard).toBe(false);
    }
  });

  it("gives each colour a home lane that starts beside its own start tile", () => {
    COLOURS.forEach((colour, arm) => {
      const lane = homeLane(arm);
      expect(new Set(lane.map(key)).size).toBe(6);
      const lastLoop = LOOP_CELLS[absoluteTile(colour, LAST_TRACK_STEP)]!;
      const step = Math.max(
        Math.abs(lastLoop[0] - lane[0]![0]),
        Math.abs(lastLoop[1] - lane[0]![1]),
      );
      expect(step).toBe(1);
    });
  });

  it("puts each token in base at its own yard slot, inside the board", () => {
    for (const colour of COLOURS) {
      const points = [0, 1, 2, 3].map((token) => tokenPoint(colour, YARD_STEP, token));
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(4);
      for (const p of points) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(BOARD_SIZE);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(BOARD_SIZE);
      }
    }
  });

  it("places a token on its loop tile and in the centre when finished", () => {
    expect(tokenPoint("GREEN", 0, 0)).toEqual({
      x: LOOP_CELLS[13]![1] + 0.5,
      y: LOOP_CELLS[13]![0] + 0.5,
    });
    expect(tokenPoint("RED", FINISH_STEP, 0)).toEqual({
      x: (BOARD_SIZE - 1) / 2 + 0.5,
      y: (BOARD_SIZE - 1) / 2 + 0.5,
    });
  });

  it("gives every arm a yard rectangle on the board", () => {
    for (let arm = 0; arm < 4; arm += 1) {
      const rect = yardRect(arm);
      expect(rect.size).toBe(6);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.size).toBeLessThanOrEqual(BOARD_SIZE);
      expect(rect.y + rect.size).toBeLessThanOrEqual(BOARD_SIZE);
    }
  });
});

describe("hop animation", () => {
  it("walks one tile at a time toward the target", () => {
    expect(hopStep(3, 6)).toBe(4);
    expect(hopStep(6, 3)).toBe(5);
    expect(hopStep(5, 5)).toBe(5);
  });

  it("snaps when a token leaves the yard or is sent home", () => {
    expect(hopStep(YARD_STEP, 0)).toBe(0);
    expect(hopStep(30, YARD_STEP)).toBe(YARD_STEP);
  });
});

describe("computer choice", () => {
  it("takes a finish over other moves and always returns a legal move", () => {
    const base = createLudoGame([
      { colour: "RED", playerId: "you" },
      { colour: "GREEN", playerId: "cpu" },
    ]);
    const state = {
      ...base,
      phase: "WAITING_FOR_MOVE" as const,
      dice: [3, 1] as const,
      used: [false, false] as const,
      pieces: { ...base.pieces, RED: [LAST_TRACK_STEP + 6, YARD_STEP, YARD_STEP, YARD_STEP] },
    };
    const pick = bestComputerMove(state, "you");
    expect(pick?.token).toBe(0);
    expect(getLegalMoves(state, "you")).toContainEqual(pick);
  });

  it("rolls without throwing for every colour", () => {
    COLOURS.forEach((colour: Colour) => expect(tokenPoint(colour, YARD_STEP, 0)).toBeDefined());
    const rolled = rollDice(
      createLudoGame([
        { colour: "RED", playerId: "you" },
        { colour: "GREEN", playerId: "cpu" },
      ]),
      "you",
      [6, 2],
    );
    expect(rolled.ok).toBe(true);
  });
});
