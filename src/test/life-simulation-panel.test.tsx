import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSimulationState } from "@/lib/life-simulation";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import { LifeSimulationPanel } from "@/components/game/LifeSimulationPanel";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { thirst: 35 } }) }));
vi.mock("@/lib/game", () => ({ q: { character: () => ({ queryKey: ["character"] }) } }));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: createSimulationState({
      character: { id: "c1", name: "Ade", level: 1, traits: [] },
      gameTime: INITIAL_GAME_TIME,
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    setSpeed: vi.fn(),
    queue: vi.fn(),
    startNext: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    interrupt: vi.fn(),
    busy: false,
    ready: true,
  }),
}));

describe("LifeSimulationPanel", () => {
  it("shows persisted thirst as satisfaction without putting it in simulation state", () => {
    render(<LifeSimulationPanel />);
    expect(screen.getByLabelText("Thirst satisfaction: 65 percent")).toBeInTheDocument();
    expect(screen.getByText("Thirst")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });
});
