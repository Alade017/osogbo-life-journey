import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameScreenAlerts } from "@/hooks/use-game-screen-alerts";

const state = vi.hoisted(() => ({
  characterId: "character-1",
  ready: true,
  needs: {
    hunger: 60,
    energy: 60,
    hygiene: 60,
    bladder: 60,
    fun: 60,
    social: 60,
  },
  missions: [] as Array<{
    id: string;
    progress: number;
    status: string;
    mission: { title: string; target: number } | null;
  }>,
  warning: vi.fn(),
  message: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    ready: state.ready,
    simulation: {
      character: { id: state.characterId },
      needs: state.needs,
    },
  }),
}));

vi.mock("@/hooks/use-missions", () => ({
  useMissions: () => ({ characterId: state.characterId, data: state.missions }),
}));

vi.mock("sonner", () => ({
  toast: {
    warning: state.warning,
    message: state.message,
    success: state.success,
  },
}));

describe("game screen alerts", () => {
  beforeEach(() => {
    state.characterId = "character-1";
    state.ready = true;
    state.needs = {
      hunger: 60,
      energy: 60,
      hygiene: 60,
      bladder: 60,
      fun: 60,
      social: 60,
    };
    state.missions = [];
    state.warning.mockClear();
    state.message.mockClear();
    state.success.mockClear();
  });

  it("uses the first synced needs and mission values as a silent baseline", () => {
    state.needs = { ...state.needs, hunger: 10 };
    state.missions = [
      {
        id: "mission-1",
        progress: 5,
        status: "completed",
        mission: { title: "First job", target: 5 },
      },
    ];

    renderHook(useGameScreenAlerts);

    expect(state.warning).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.message).not.toHaveBeenCalled();
  });

  it("pops up for mission progress and completion once each", () => {
    state.missions = [
      {
        id: "mission-1",
        progress: 0,
        status: "in_progress",
        mission: { title: "First job", target: 5 },
      },
    ];
    const { rerender } = renderHook(useGameScreenAlerts);

    state.missions = [
      {
        id: "mission-1",
        progress: 1,
        status: "in_progress",
        mission: { title: "First job", target: 5 },
      },
    ];
    rerender();
    expect(state.message).toHaveBeenCalledExactlyOnceWith("First job: 1/5");

    state.missions = [
      {
        id: "mission-1",
        progress: 5,
        status: "completed",
        mission: { title: "First job", target: 5 },
      },
    ];
    rerender();
    expect(state.success).toHaveBeenCalledExactlyOnceWith("Mission complete: First job");
    rerender();
    expect(state.success).toHaveBeenCalledExactlyOnceWith("Mission complete: First job");
  });

  it("alerts only when needs enter critical and alerts again after recovery", () => {
    state.needs = { ...state.needs, hunger: 16 };
    const { rerender } = renderHook(useGameScreenAlerts);

    state.needs = { ...state.needs, hunger: 15 };
    rerender();
    expect(state.warning).toHaveBeenCalledExactlyOnceWith("Critical needs: Hunger");

    state.needs = { ...state.needs, hunger: 20 };
    rerender();
    state.needs = { ...state.needs, hunger: 14 };
    rerender();
    expect(state.warning).toHaveBeenCalledTimes(2);
  });

  it("groups needs that become critical in the same simulation update", () => {
    const { rerender } = renderHook(useGameScreenAlerts);

    state.needs = { ...state.needs, hunger: 15, energy: 15 };
    rerender();

    expect(state.warning).toHaveBeenCalledExactlyOnceWith("Critical needs: Hunger, Energy");
  });
});
