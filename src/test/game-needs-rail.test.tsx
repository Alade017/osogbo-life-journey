import { render, screen } from "@testing-library/react";
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
  it("shows all six needs immediately without navigation links or a toggle", () => {
    const { container } = render(<GameNeedsRail player={player} />);
    expect(screen.getByRole("complementary", { name: "Ayo's needs dashboard" })).toBeVisible();
    expect(container.querySelectorAll(".game-needs-item")).toHaveLength(6);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(screen.getByText("20%")).toBeVisible();
    expect(screen.getByText("Needs care soon")).toBeVisible();
  });
});
