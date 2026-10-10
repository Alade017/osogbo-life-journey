import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameTimeProvider, useGameTime } from "@/components/game/GameTimeProvider";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import type { Character } from "@/lib/game";

const server = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("@/lib/simulation-service", () => ({ simulationCommand: server.command }));
function Probe() {
  const { simulation } = useGameTime();
  return <output aria-label="Energy">{simulation.needs.energy}</output>;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
describe("active session simulation", () => {
  it("stops heartbeats in a hidden tab and reconnects without submitting offline elapsed time", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    server.command.mockResolvedValue({
      revision: 1,
      needs: { hunger: 80, energy: 70, hygiene: 80, bladder: 72, fun: 70, social: 60 },
      game_time: INITIAL_GAME_TIME,
      paused: false,
      speed: 1,
      action: null,
      request_id: null,
      skills: {},
      queued_actions: [],
    });
    const character = {
      id: "player1",
      name: "Ade",
      level: 1,
      xp: 0,
      energy: 70,
      hunger: 20,
      happiness: 70,
      social: 60,
    } as Character;
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
    await act(async () => {
      render(
        <QueryClientProvider client={qc}>
          <GameTimeProvider character={character} gameTime={INITIAL_GAME_TIME}>
            <Probe />
          </GameTimeProvider>
        </QueryClientProvider>,
      );
    });
    expect(server.command).toHaveBeenLastCalledWith(expect.objectContaining({ command: "open" }));
    const calls = server.command.mock.calls.length;
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(3600000);
    });
    expect(server.command).toHaveBeenCalledTimes(calls);
    expect(screen.getByLabelText("Energy")).toHaveTextContent("70");
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(server.command).toHaveBeenLastCalledWith(expect.objectContaining({ command: "open" }));
    expect(server.command.mock.calls.at(-1)?.[0]).not.toHaveProperty("elapsedSeconds");
  });
});
