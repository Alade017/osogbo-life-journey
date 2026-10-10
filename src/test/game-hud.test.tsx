import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSimulationState } from "@/lib/life-simulation";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import { playerStateFromRows } from "@/lib/player-state";
import type { Character } from "@/lib/game";
import { GameHUD } from "@/components/game/GameHUD";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/game/Avatar", () => ({ Avatar: () => <span>Avatar</span> }));
vi.mock("@/components/game/Logo", () => ({ Logo: () => <span>Logo</span> }));
const controls = vi.hoisted(() => ({
  pause: vi.fn(),
  resume: vi.fn(),
  setSpeed: vi.fn(),
  reconnect: vi.fn(),
}));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: createSimulationState({
      character: { id: "c1", name: "Ade", level: 4, traits: [] },
      gameTime: INITIAL_GAME_TIME,
    }),
    ...controls,
    ready: true,
    busy: false,
    syncError: null,
  }),
}));
describe("shared player HUD", () => {
  it("exposes needs shortcuts separately from the profile and labels both clocks", () => {
    const character = {
      id: "c1",
      name: "Ade",
      level: 4,
      xp: 350,
      gender: "male",
      appearance: {},
      energy: 80,
      hunger: 20,
      health: 90,
      happiness: 70,
      social: 60,
    } as Character;
    render(
      <GameHUD
        player={playerStateFromRows({ character, wallet: null, location: null })}
        location="Student District"
        unread={3}
      />,
    );
    expect(screen.getByLabelText(/Hunger .*Show activity shortcut/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Hunger .*Show activity shortcut/));
    expect(screen.getByRole("link", { name: /Choose food from your inventory/ })).toHaveAttribute(
      "href",
      "/inventory",
    );
    expect(screen.getByText(/PERSONAL TIME/)).toBeInTheDocument();
    expect(screen.getByText("LAGOS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(controls.pause).toHaveBeenCalled();
  });
});
