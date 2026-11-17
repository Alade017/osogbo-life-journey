import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameNeedsRail } from "@/components/game/GameNeedsRail";
import type { PlayerState } from "@/lib/player-state";

vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: {
      needs: { hunger: 20, energy: 78, hygiene: 82, bladder: 60, fun: 70, social: 10 },
    },
  }),
}));

const player = {
  name: "Ayo",
  avatar: {},
  gender: "female",
  equipment: [],
} as unknown as PlayerState;

describe("persistent player needs dashboard", () => {
  it("shows six compact, keyboard-operable needs with an at-a-glance critical state", () => {
    const { container } = render(<GameNeedsRail player={player} />);
    expect(
      screen.getByRole("complementary", { name: "Ayo's needs dashboard, 1 critical" }),
    ).toBeVisible();
    expect(container.querySelectorAll(".game-needs-item")).toHaveLength(6);
    expect(container.querySelectorAll(".game-needs-icon-ring")).toHaveLength(6);
    expect(container.querySelector(".game-needs-summary")).toHaveTextContent("1 critical");
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelectorAll(".game-needs-item")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Hunger: 20 percent, warning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Social: 10 percent, critical" })).toHaveClass(
      "is-critical",
    );
    expect(screen.getByTitle("Hunger: 20% · Tap for details")).toBeInTheDocument();
    expect(screen.queryByText("Hunger")).not.toBeInTheDocument();
    // Each need shows its percentage beside the ring, so the at-a-glance state is readable.
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("reveals the tapped need's exact level and status", () => {
    render(<GameNeedsRail player={player} />);
    const socialNeed = screen.getByRole("button", { name: "Social: 10 percent, critical" });
    fireEvent.click(socialNeed);
    expect(socialNeed).toHaveAttribute("aria-pressed", "true");
    const detail = screen.getByRole("status", { name: "Social need status" });
    expect(detail).toHaveTextContent("Social");
    expect(detail).toHaveTextContent("10% · critical");
  });
  it("hides the panel into a tab and brings it back", () => {
    const { container } = render(<GameNeedsRail player={player} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse needs panel" }));
    expect(container.querySelector(".game-needs-rail")).toHaveClass("is-collapsed");
    const tab = screen.getByRole("button", { name: /Expand needs panel/ });
    expect(tab).toHaveAttribute("aria-expanded", "false");
    expect(tab).toHaveClass("game-needs-tab");
    fireEvent.click(tab);
    expect(container.querySelector(".game-needs-rail")).not.toHaveClass("is-collapsed");
    expect(screen.getByRole("button", { name: "Collapse needs panel" })).toBeInTheDocument();
  });
  it("starts the map panel collapsed and keeps needs available on demand", () => {
    const { container } = render(<GameNeedsRail player={player} compact />);
    expect(screen.getByRole("button", { name: /Expand needs panel/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(container.querySelector(".game-needs-rail")).toHaveClass("is-collapsed");
    fireEvent.click(screen.getByRole("button", { name: /Expand needs panel/ }));
    expect(container.querySelectorAll(".game-needs-item")).toHaveLength(6);
  });
});
