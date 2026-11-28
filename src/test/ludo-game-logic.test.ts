import { describe, expect, it } from "vitest";
import { movesForPawn, seatsFor } from "@/components/game/mini-games/LudoGame";
import type { LegalMove } from "@/lib/mini-games/ludo-engine";

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

describe("Ludo pawn choice", () => {
  const moves: LegalMove[] = [
    { colour: "RED", token: 0, to: 6, die: 0 },
    { colour: "RED", token: 1, to: 4, die: 1 },
    { colour: "GREEN", token: 0, to: 3, die: 1 },
  ];

  it("lists the one die a pawn can use", () => {
    expect(movesForPawn(moves, "RED", 0, null).map((move) => move.die)).toEqual([0]);
  });

  it("filters a pawn's moves to the chosen die", () => {
    expect(movesForPawn(moves, "RED", 1, 1).map((move) => move.to)).toEqual([4]);
    expect(movesForPawn(moves, "RED", 1, 0)).toEqual([]);
  });

  it("returns nothing for a pawn with no legal move", () => {
    expect(movesForPawn(moves, "GREEN", 0, 0)).toEqual([]);
  });
});
