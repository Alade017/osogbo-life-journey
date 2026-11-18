import { describe, expect, it } from "vitest";
import { moveForTap, seatsFor } from "@/components/game/mini-games/LudoGame";
import { createLudoGame, getLegalMoves, type LegalMove } from "@/lib/mini-games/ludo-engine";

describe("Ludo seating", () => {
  it("gives the human the colour they picked, with computers in board order", () => {
    expect(seatsFor(3, "YELLOW").map((seat) => seat.colour)).toEqual(["YELLOW", "RED", "GREEN"]);
    expect(seatsFor(4, "BLUE").map((seat) => seat.colour)).toEqual(["BLUE", "RED", "GREEN", "YELLOW"]);
    expect(seatsFor(4, "BLUE")[0]?.playerId).toBe("you");
    expect(seatsFor(4, "BLUE").slice(1).every((seat) => seat.playerId.startsWith("cpu-"))).toBe(true);
  });

  it("keeps the two-player split: human on Red and Yellow", () => {
    const seats = seatsFor(2, "RED");
    expect(seats.filter((seat) => seat.playerId === "you").map((seat) => seat.colour)).toEqual([
      "RED",
      "YELLOW",
    ]);
  });

  it("pairs the human with the colour picked and its opposite arm for two players", () => {
    const greenSeats = seatsFor(2, "GREEN");
    expect(greenSeats.filter((seat) => seat.playerId === "you").map((seat) => seat.colour)).toEqual([
      "GREEN",
      "BLUE",
    ]);
    expect(greenSeats.filter((seat) => seat.playerId !== "you").map((seat) => seat.colour)).toEqual([
      "YELLOW",
      "RED",
    ]);
    const yellowSeats = seatsFor(2, "YELLOW");
    expect(yellowSeats.filter((seat) => seat.playerId === "you").map((seat) => seat.colour)).toEqual([
      "YELLOW",
      "RED",
    ]);
  });
});

describe("Ludo tap resolution", () => {
  const moves: LegalMove[] = [
    { colour: "RED", token: 0, to: 6, die: 0 },
    { colour: "RED", token: 1, to: 0, die: null },
    { colour: "RED", token: 1, to: 0, die: 1 },
    { colour: "GREEN", token: 0, to: 3, die: 1 },
  ];

  it("prefers the free deploy over spending a die on the same pawn", () => {
    expect(moveForTap(moves, "RED", 1, null)?.die).toBe(null);
    expect(moveForTap(moves, "RED", 1, 1)?.die).toBe(null);
  });

  it("uses the chosen die when a pawn has one option for it", () => {
    expect(moveForTap(moves, "RED", 0, 0)?.to).toBe(6);
  });

  it("needs a die picked first when a pawn could use either die", () => {
    const twoDice: LegalMove[] = [
      { colour: "RED", token: 0, to: 6, die: 0 },
      { colour: "RED", token: 0, to: 4, die: 1 },
    ];
    expect(moveForTap(twoDice, "RED", 0, null)).toBe(null);
    expect(moveForTap(twoDice, "RED", 0, 1)?.to).toBe(4);
  });

  it("returns nothing for a pawn the chosen die cannot move", () => {
    expect(moveForTap(moves, "GREEN", 0, 0)).toBe(null);
  });

  it("only offers the free deploy once a capture has set the flag", () => {
    const game = createLudoGame([
      { colour: "RED", playerId: "you" },
      { colour: "GREEN", playerId: "cpu-1" },
    ]);
    expect(game.freeDeploy).toBe(false);
    expect(getLegalMoves(game, "you").some((move) => move.die === null)).toBe(false);
  });
});
