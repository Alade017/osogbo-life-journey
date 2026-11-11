import { describe, expect, it } from "vitest";
import {
  CLEARED,
  YARD,
  bestLudoMove,
  legalMoves,
  moveLudoSeed,
  newLudo,
  passLudoTurn,
  rollLudo,
  seedsPerSide,
  type LudoMode,
  type LudoState,
} from "@/lib/mini-games/ludo";

/** A position with the given seed progress: [house, token, progress] edits on a new game. */
function withSeeds(
  mode: LudoMode,
  edits: [number, number, number][],
  turn = 0,
  pending: number[] | null = null,
): LudoState {
  const base = newLudo(mode);
  const seeds = base.seeds.map((row) => [...row]);
  for (const [house, token, progress] of edits) seeds[house]![token] = progress;
  return { ...base, seeds, turn, pending };
}

/** Plays every die the position allows, always taking the first legal move. */
function playAll(state: LudoState): LudoState {
  let current = state;
  for (let guard = 0; guard < 10 && current.pending && legalMoves(current).length > 0; guard += 1) {
    current = moveLudoSeed(current, legalMoves(current)[0]!);
  }
  return current;
}

describe("ludo rules: bringing seeds out", () => {
  it("a roll with no six and no seed on the board passes the turn", () => {
    const state = rollLudo(newLudo(1), 3, 2);
    expect(state.pending).toBeNull();
    expect(state.turn).toBe(1);
    expect(state.seeds[0]?.every((progress) => progress === YARD)).toBe(true);
  });

  it("only a six brings a seed out, and the six is then played", () => {
    const state = rollLudo(newLudo(1), 6, 2);
    const moves = legalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
    // The six must bring a seed out; the two then moves that seed (mandatory play).
    for (const move of moves) {
      expect(move.from).toBe(YARD);
      expect(move.to).toBe(0);
      expect(move.uses).toEqual([0]);
    }
    const next = moveLudoSeed(state, moves[0]!);
    expect(next.pending).toEqual([2]);
    expect(legalMoves(next).every((move) => move.uses.length === 1)).toBe(true);
  });

  it("double six brings two seeds out and gives a bonus turn", () => {
    let state = rollLudo(newLudo(1), 6, 6);
    state = moveLudoSeed(
      state,
      legalMoves(state).find((move) => move.from === YARD)!,
    );
    state = moveLudoSeed(
      state,
      legalMoves(state).find((move) => move.from === YARD)!,
    );
    expect(state.seeds[0]?.filter((progress) => progress === 0)).toHaveLength(2);
    expect(state.turn).toBe(0);
    expect(state.pending).toBeNull();
  });
});

describe("ludo rules: dice and movement", () => {
  it("lets two dice move two seeds, or one seed the combined total", () => {
    const state = withSeeds(
      1,
      [
        [0, 0, 10],
        [0, 1, 20],
      ],
      0,
      [5, 2],
    );
    const moves = legalMoves(state);
    expect(moves.some((move) => move.uses.length === 2 && move.to === 17)).toBe(true);
    expect(moves.some((move) => move.uses.length === 1 && move.to === 15)).toBe(true);
  });

  it("a single die cannot bring a seed out, so the combined total cannot either", () => {
    const state = withSeeds(1, [[0, 0, 10]], 0, [3, 2]);
    const moves = legalMoves(state);
    expect(moves.every((move) => move.from !== YARD)).toBe(true);
    expect(moves.some((move) => move.uses.length === 2 && move.from === YARD)).toBe(false);
  });

  it("mandatory play: a die that can be played must be played", () => {
    // The seed at 54 can take the 2 (to 56) but not the 5, so only the 2 is legal.
    const state = withSeeds(1, [[0, 0, 54]], 0, [2, 5]);
    const moves = legalMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.uses).toEqual([0]);
    expect(moves[0]?.to).toBe(CLEARED);
  });

  it("an exact finish: a seed cannot overshoot the centre", () => {
    const state = withSeeds(1, [[0, 0, 54]], 0, [3, 1]);
    const moves = legalMoves(state);
    expect(moves.every((move) => move.to <= CLEARED)).toBe(true);
    expect(moves.some((move) => move.to === 55 && move.uses[0] === 1)).toBe(true);
    expect(moves.some((move) => move.to === 57)).toBe(false);
  });

  it("a single six does not give a bonus turn", () => {
    const state = rollLudo(withSeeds(1, [[0, 0, 10]]), 6, 1);
    const after = playAll(state);
    expect(after.pending).toBeNull();
    expect(after.turn).toBe(1);
  });
});

describe("ludo rules: capturing", () => {
  it("landing on an opponent seed sends it back and clears the capturing seed", () => {
    // Our seed at progress 10 moves 3 to square 13. Yellow's progress 39 is square 13.
    const state = withSeeds(
      1,
      [
        [0, 0, 10],
        [2, 0, 39],
      ],
      0,
      [3, 6],
    );
    const move = legalMoves(state).find(
      (item) => item.house === 0 && item.token === 0 && item.to === 13 && item.uses.join() === "0",
    );
    expect(move).toBeDefined();
    const after = moveLudoSeed(state, move!);
    expect(after.seeds[2]?.[0]).toBe(YARD);
    expect(after.seeds[0]?.[0]).toBe(CLEARED);
  });

  it("there are no safe squares: a start square does not protect a seed", () => {
    // Square 13 is green's start square, which is a safe square in classic Ludo.
    const state = withSeeds(
      1,
      [
        [0, 0, 10],
        [2, 0, 39],
      ],
      0,
      [3, 6],
    );
    const move = legalMoves(state).find(
      (item) => item.house === 0 && item.token === 0 && item.to === 13,
    );
    expect(move).toBeDefined();
  });

  it("captures only on the track, not in an opponent's home column", () => {
    // Yellow's seed at progress 52 is in its home column. Our seed landing on the same loop
    // index (26) must not capture it.
    const state = withSeeds(
      1,
      [
        [0, 0, 23],
        [2, 0, 52],
      ],
      0,
      [3, 6],
    );
    const after = moveLudoSeed(
      state,
      legalMoves(state).find((item) => item.house === 0 && item.token === 0 && item.to === 26)!,
    );
    expect(after.seeds[2]?.[0]).toBe(52);
    expect(after.seeds[0]?.[0]).toBe(26);
  });

  it("own seeds do not block: a stack of your own seeds can be landed on", () => {
    const state = withSeeds(
      1,
      [
        [0, 0, 10],
        [0, 1, 10],
        [0, 2, 7],
      ],
      0,
      [3, 6],
    );
    const moves = legalMoves(state);
    expect(moves.some((move) => move.token === 2 && move.to === 10)).toBe(true);
  });
});

describe("ludo rules: winning", () => {
  it("a side wins when all of its seeds are cleared", () => {
    const state = withSeeds(
      1,
      [
        [0, 0, CLEARED],
        [0, 1, CLEARED],
        [0, 2, CLEARED],
        [0, 3, 55],
      ],
      0,
      [1, 1],
    );
    const after = moveLudoSeed(state, legalMoves(state)[0]!);
    expect(after.winner).toBe(0);
    expect(after.pending).toBeNull();
  });

  it("in a double-house game a side needs all eight seeds", () => {
    expect(seedsPerSide(2)).toBe(8);
    const edits: [number, number, number][] = [];
    for (const house of [0, 2])
      for (const token of [0, 1, 2, 3]) edits.push([house, token, CLEARED]);
    edits[7] = [2, 3, 55];
    const state = withSeeds(2, edits, 0, [1, 1]);
    const after = moveLudoSeed(state, legalMoves(state)[0]!);
    expect(after.winner).toBe(0);
  });

  it("a double-house side is not won while one seed is still out", () => {
    const edits: [number, number, number][] = [];
    for (const house of [0, 2])
      for (const token of [0, 1, 2, 3]) edits.push([house, token, CLEARED]);
    edits[7] = [2, 3, 55];
    const state = withSeeds(2, edits.slice(0, 7), 0, [1, 1]);
    expect(state.winner).toBeNull();
  });
});

describe("ludo computer", () => {
  function seeded(seed: number) {
    let value = seed;
    return () => {
      value = (value * 1103515245 + 12345) % 2147483648;
      return value / 2147483648;
    };
  }

  it("always chooses a legal move when it has one", () => {
    const state = withSeeds(
      1,
      [
        [0, 0, 10],
        [2, 0, 30],
      ],
      1,
      [4, 6],
    );
    const move = bestLudoMove(state);
    expect(move).not.toBeNull();
    expect(
      legalMoves(state).some(
        (legal) =>
          legal.house === move!.house && legal.token === move!.token && legal.to === move!.to,
      ),
    ).toBe(true);
  });

  it("plays both modes to a winner", () => {
    for (const mode of [1, 2] as const) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const rng = seeded(seed * 31 + mode);
        let state = newLudo(mode);
        let steps = 0;
        while (state.winner === null && steps < 20000) {
          if (state.pending === null) {
            state = rollLudo(state, 1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6));
          } else {
            const move = bestLudoMove(state);
            state = move ? moveLudoSeed(state, move) : passLudoTurn(state);
          }
          steps += 1;
        }
        expect(state.winner).not.toBeNull();
      }
    }
  });
});
