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
    expect(screen.queryByText("20%")).not.toBeInTheDocument();
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
  it("shows the most urgent needs as compact pills in preview mode", () => {
    const { container } = render(<GameNeedsRail player={player} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse needs panel" }));
    expect(container.querySelector(".game-needs-toggle")).toHaveStyle({ width: "42px", height: "42px" });
    expect(container.querySelectorAll(".game-needs-preview-pill")).toHaveLength(2);
    expect(container.querySelector(".game-needs-preview")).toHaveTextContent("Social");
    expect(container.querySelector(".game-needs-preview")).toHaveTextContent("Hunger");
    expect(container.querySelector(".game-needs-list")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Social: 10 percent, critical/ }));
    expect(screen.getByRole("status", { name: "Social need status" })).toHaveTextContent("10%");
  });
});
