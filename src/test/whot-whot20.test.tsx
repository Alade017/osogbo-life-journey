import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhotGame } from "@/components/game/mini-games/WhotGame";

/** A deterministic random source, so each seed deals a different but repeatable hand. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("Whot 20 in a real deal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("opens the shape picker when a Whot 20 is tapped, and plays the chosen shape", () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed += 1) {
      vi.spyOn(Math, "random").mockImplementation(seeded(seed));
      vi.useFakeTimers();
      const view = render(<WhotGame />);
      act(() => vi.advanceTimersByTime(1500));
      const whot = screen.queryAllByRole("button", { name: "Whot card" })[0];
      if (whot) {
        found = true;
        fireEvent.click(whot);
        const dialog = screen.getByRole("dialog", { name: "Choose a shape" });
        expect(within(dialog).getAllByRole("button").length).toBeGreaterThanOrEqual(5);
        fireEvent.click(within(dialog).getByRole("button", { name: /Star/ }));
        expect(screen.queryByRole("dialog", { name: "Choose a shape" })).toBeNull();
      }
      view.unmount();
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
    expect(found).toBe(true);
  });
});
