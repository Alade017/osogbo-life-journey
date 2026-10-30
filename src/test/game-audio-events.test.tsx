import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useGameAudioEvents } from "../hooks/use-game-audio-events";
vi.mock("@/hooks/use-missions", () => ({ useMissions: () => ({ data: state.missions }) }));
const state = vi.hoisted(() => ({
  character: { id: "a", level: 1, xp: 10, health: 50, energy: 40 },
  missions: [{ id: "m1", status: "active" }],
  play: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (query: { kind: string }) => ({
    data: query.kind === "character" ? state.character : state.missions,
  }),
}));
vi.mock("@/lib/game", () => ({
  q: { character: () => ({ kind: "character" }), missions: () => ({ kind: "missions" }) },
}));
vi.mock("@/lib/game-audio", () => ({ playGameSound: state.play }));
beforeEach(() => {
  state.character = { id: "a", level: 1, xp: 10, health: 50, energy: 40 };
  state.missions = [{ id: "m1", status: "active" }];
  state.play.mockClear();
});
it("plays XP and recovery effects only after confirmed increases", () => {
  const { rerender } = renderHook(useGameAudioEvents);
  expect(state.play).not.toHaveBeenCalled();
  state.character = { ...state.character, xp: 12 };
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("xp-gain");
  state.play.mockClear();
  state.character = { ...state.character, health: 55 };
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("health-recharge");
  state.play.mockClear();
  state.character = { ...state.character, energy: 45 };
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("energy-recharge");
  state.play.mockClear();
  state.character = { ...state.character };
  rerender();
  expect(state.play).not.toHaveBeenCalled();
});
it("prioritizes level-up and ignores character switches and resource decreases", () => {
  const { rerender } = renderHook(useGameAudioEvents);
  state.character = { ...state.character, level: 2, xp: 30 };
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("level-up");
  state.play.mockClear();
  state.character = { id: "b", level: 5, xp: 500, health: 100, energy: 100 };
  rerender();
  expect(state.play).not.toHaveBeenCalled();
  state.character = { ...state.character, health: 90, energy: 90 };
  rerender();
  expect(state.play).not.toHaveBeenCalled();
});
it("sounds once on mission completion and confirmed reward collection", () => {
  const { rerender } = renderHook(useGameAudioEvents);
  state.missions = [{ id: "m1", status: "completed" }];
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("mission-complete");
  state.play.mockClear();
  state.missions = [...state.missions];
  rerender();
  expect(state.play).not.toHaveBeenCalled();
  state.missions = [{ id: "m1", status: "claimed" }];
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("reward");
  state.play.mockClear();
  state.missions = [...state.missions];
  rerender();
  expect(state.play).not.toHaveBeenCalled();
});
it("skips completed missions on initial load, newly loaded rows and character changes", () => {
  state.missions = [{ id: "m1", status: "completed" }];
  const { rerender } = renderHook(useGameAudioEvents);
  expect(state.play).not.toHaveBeenCalled();
  state.missions = [...state.missions, { id: "m2", status: "completed" }];
  rerender();
  expect(state.play).not.toHaveBeenCalled();
  state.character = { ...state.character, id: "b" };
  state.missions = [{ id: "m1", status: "claimed" }];
  rerender();
  expect(state.play).not.toHaveBeenCalled();
});
