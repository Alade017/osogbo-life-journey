import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GamesApp } from "@/components/game/mini-games/GamesApp";

vi.mock("@/components/game/mini-games/StakeTables", () => ({
  StakeTables: () => <p>Stake tables (mocked)</p>,
}));

describe("games hub and boards", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists the games as illustrated tiles", () => {
    render(<GamesApp />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Tic-Tac-Toe/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Whot/ })).toBeInTheDocument();
  });

  it("draws a mark on the tic-tac-toe square the player taps", () => {
    vi.useFakeTimers();
    const { container } = render(<GamesApp />);
    fireEvent.click(screen.getByRole("button", { name: /Tic-Tac-Toe/ }));
    const board = screen.getByRole("group", { name: "Tic-Tac-Toe board" });
    const squares = within(board).getAllByRole("button");
    expect(squares).toHaveLength(9);
    expect(container.querySelectorAll(".mg-mark")).toHaveLength(0);
    fireEvent.click(squares[0]!);
    expect(container.querySelector(".mg-mark-X")).toBeInTheDocument();
    expect(squares[0]).toBeDisabled();
  });

  it("shows the Whot hand as card faces with labels", () => {
    const { container } = render(<GamesApp />);
    fireEvent.click(screen.getByRole("button", { name: /Whot/ }));
    const hand = screen.getByRole("group", { name: "Your hand" });
    const cards = within(hand).getAllByRole("button");
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.getAttribute("aria-label")).toMatch(
        /Whot card|\d+ (circle|triangle|cross|square|star)/,
      );
    }
    expect(container.querySelectorAll(".mg-card-art").length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText(/Your turn|The computer is playing/)).toBeInTheDocument();
  });
});
