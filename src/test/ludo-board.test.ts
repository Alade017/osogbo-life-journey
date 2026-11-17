import { describe, expect, it } from "vitest";
import {
  BASE,
  FINISHED,
  LOOP_LENGTH,
  absoluteSquare,
  isSafeSquare,
  newLudo,
} from "../lib/mini-games/ludo.ts";
import {
  BOARD_SIZE,
  LOOP_CELLS,
  armFor,
  homeLane,
  loopCentre,
  tokenPoint,
  yardRect,
} from "../lib/mini-games/ludo-board.ts";

const key = ([r, c]: readonly [number, number]) => `${r},${c}`;
const inBoard = ([r, c]: readonly [number, number]) =>
  r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;

describe("ludo board geometry", () => {
  it("has a 52-square loop of distinct cells on the board", () => {
    expect(LOOP_CELLS).toHaveLength(LOOP_LENGTH);
    expect(new Set(LOOP_CELLS.map(key)).size).toBe(LOOP_LENGTH);
    expect(LOOP_CELLS.every(inBoard)).toBe(true);
  });

  it("keeps the loop connected, wrapping back to the start", () => {
    LOOP_CELLS.forEach((cell, index) => {
      const next = LOOP_CELLS[(index + 1) % LOOP_LENGTH]!;
      const step = Math.max(Math.abs(cell[0] - next[0]), Math.abs(cell[1] - next[1]));
      expect(step, `square ${index}`).toBe(1);
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

  it("gives each arm a home lane of six cells that leads from the loop to the centre", () => {
    for (let arm = 0; arm < 4; arm += 1) {
      const lane = homeLane(arm);
      expect(lane).toHaveLength(6);
      expect(new Set(lane.map(key)).size).toBe(6);
      expect(lane.some((cell) => LOOP_CELLS.some((loop) => key(loop) === key(cell)))).toBe(false);
    }
  });

  it("places each player's home lane beside the loop square it leaves from", () => {
    for (let player = 0; player < 2; player += 1) {
      const arm = armFor(player, 2);
      const lastLoop = LOOP_CELLS[absoluteSquare(player, 50, 2)]!;
      const firstHome = homeLane(arm)[0]!;
      const step = Math.max(
        Math.abs(lastLoop[0] - firstHome[0]),
        Math.abs(lastLoop[1] - firstHome[1]),
      );
      expect(step).toBe(1);
    }
  });

  it("puts a token in base at its own yard slot, inside the board", () => {
    const state = newLudo(2);
    for (let player = 0; player < 2; player += 1) {
      const points = [0, 1, 2, 3].map((token) => tokenPoint(player, 2, BASE, token));
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(4);
      for (const p of points) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.y).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(BOARD_SIZE);
        expect(p.y).toBeLessThan(BOARD_SIZE);
      }
    }
    expect(state.tokens[0]).toHaveLength(4);
  });

  it("walks a token from base around the loop into the centre", () => {
    const finish = tokenPoint(0, 2, FINISHED, 0);
    expect(finish).toEqual({ x: (BOARD_SIZE - 1) / 2 + 0.5, y: (BOARD_SIZE - 1) / 2 + 0.5 });
    const first = tokenPoint(0, 2, 0, 0);
    const centre = loopCentre(absoluteSquare(0, 0, 2));
    expect(first).toEqual(centre);
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
