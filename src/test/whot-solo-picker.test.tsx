import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhotGame } from "@/components/game/mini-games/WhotGame";

const card = (id: string, shape: string | null, rank: number) => ({ id, shape, rank });

vi.mock("@/lib/mini-games/whot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mini-games/whot")>();
  return {
    ...actual,
    newWhot: () => ({
      playerCount: 2,
      hands: [
        [card("whot-1", null, 20), card("circle-3", "circle", 3)],
        [card("star-2", "star", 2), card("cross-9", "cross", 9)],
      ],
      stock: [card("square-1", "square", 1), card("star-1", "star", 1)],
      discard: [card("circle-7", "circle", 7)],
      shape: "circle" as const,
      turn: 0,
      pendingDraw: 0,
      pendingRank: null,
      winner: null,
    }),
  };
});

describe("solo Whot shape picker", () => {
  afterEach(() => cleanup());

  it("shows the hand straight away with no start gate", () => {
    vi.useFakeTimers();
    render(<WhotGame />);
    expect(screen.queryByRole("button", { name: "Start the game" })).toBeNull();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("group", { name: "Your hand" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("lets the player pick a shape after playing a Whot card", () => {
    vi.useFakeTimers();
    render(<WhotGame />);
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.click(screen.getByRole("button", { name: "Whot card" }));
    const dialog = screen.getByRole("dialog", { name: "Choose a shape" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Star/ }));
    expect(screen.queryByRole("dialog", { name: "Choose a shape" })).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
