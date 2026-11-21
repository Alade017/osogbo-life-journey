import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameNeedsRail } from "@/components/game/GameNeedsRail";
import type { PlayerState } from "@/lib/player-state";

const state = vi.hoisted(() => ({ start: vi.fn(), busy: false, ready: true }));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    ...state,
    simulation: {
      needs: { hunger: 20, energy: 78, hygiene: 82, bladder: 60, fun: 70, social: 10 },
    },
  }),
}));
const player = { name: "Ayo" } as PlayerState;
beforeEach(() => {
  state.start.mockReset().mockResolvedValue(null);
  state.busy = false;
  state.ready = true;
});
const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /Expand needs panel/ }));

describe("player needs panel", () => {
  it("starts compact and shows the most urgent need without obscuring the world", () => {
    render(<GameNeedsRail player={player} />);
    expect(
      screen.getByRole("button", { name: /Expand needs panel, 1 critical need/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Social · 10%")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Character wellbeing" })).toBeNull();
  });
  it("shows all six labels and exact accessible meter values when expanded", () => {
    render(<GameNeedsRail player={player} />);
    openPanel();
    expect(screen.getAllByRole("meter")).toHaveLength(6);
    expect(screen.getByRole("meter", { name: "Hunger" })).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByRole("meter", { name: "Social" })).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByRole("button", { name: "Social: 10 percent, critical" })).toHaveTextContent(
      "Critical",
    );
    expect(screen.getByRole("button", { name: "Energy: 78 percent, healthy" })).toHaveTextContent(
      "Good",
    );
  });
  it("opens details inside the panel and restores focus when dismissed with Escape", () => {
    render(<GameNeedsRail player={player} />);
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Social: 10 percent, critical" }));
    expect(screen.getByRole("region", { name: "Social need status" })).toHaveTextContent(
      "10% · critical",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Character wellbeing" })).toBeNull();
    expect(screen.getByRole("button", { name: /Expand needs panel/ })).toHaveFocus();
  });
  it("dismisses on an outside press while keeping presses inside usable", () => {
    render(<GameNeedsRail player={player} />);
    openPanel();
    fireEvent.pointerDown(screen.getByRole("meter", { name: "Social" }));
    expect(screen.getByRole("region", { name: "Character wellbeing" })).toBeVisible();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region", { name: "Character wellbeing" })).toBeNull();
  });
  it("keeps all needs available in the map's compact mode", () => {
    render(<GameNeedsRail player={player} compact />);
    openPanel();
    expect(screen.getAllByRole("meter")).toHaveLength(6);
  });
  it("prevents duplicate activity requests while a need action is starting", async () => {
    let finish!: (value: null) => void;
    state.start.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<GameNeedsRail player={player} />);
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Hunger: 20 percent, warning" }));
    fireEvent.click(screen.getByRole("button", { name: "Eat a meal" }));
    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
    expect(state.start).toHaveBeenCalledExactlyOnceWith(
      "eat",
      expect.stringMatching(/^needs-eat-/),
    );
    await act(async () => finish(null));
    expect(screen.getByRole("region", { name: "Hunger need status" })).toHaveTextContent(
      "Eat a meal started.",
    );
  });
  it("keeps the existing Home action and closes the panel before navigation", () => {
    const openApp = vi.fn();
    window.addEventListener("osogbo-open-phone-app", openApp);
    try {
      render(<GameNeedsRail player={player} />);
      openPanel();
      fireEvent.click(screen.getByRole("button", { name: "Energy: 78 percent, healthy" }));
      fireEvent.click(screen.getByRole("button", { name: "Go home and rest" }));
      expect(openApp).toHaveBeenCalledOnce();
      expect((openApp.mock.calls[0]![0] as CustomEvent).detail).toEqual({ app: "Home" });
      expect(screen.queryByRole("region", { name: "Character wellbeing" })).toBeNull();
    } finally {
      window.removeEventListener("osogbo-open-phone-app", openApp);
    }
  });
});
