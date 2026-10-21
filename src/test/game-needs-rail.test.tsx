import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameNeedsRail } from "@/components/game/GameNeedsRail";
import type { PlayerState } from "@/lib/player-state";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    onClick?: () => void;
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/game/Avatar", () => ({ Avatar: () => <span>Avatar</span> }));
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

describe("fixed player needs control", () => {
  it("keeps the avatar and needs summary compact until opened", () => {
    const { container } = render(<GameNeedsRail player={player} />);
    const trigger = screen.getByRole("button", { name: /Ayo, player needs, 2 need attention/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelectorAll(".needs-ring-fill")).toHaveLength(6);
    expect(screen.queryByRole("region", { name: "Player needs" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Player needs" })).toBeVisible();
    expect(container.querySelectorAll(".game-needs-item")).toHaveLength(6);
    expect(screen.getByRole("link", { name: /Choose food from your inventory/i })).toHaveAttribute(
      "href",
      "/inventory",
    );
  });

  it("closes with Escape and returns focus to the button", () => {
    render(<GameNeedsRail player={player} />);
    const trigger = screen.getByRole("button", { name: /Ayo, player needs/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
