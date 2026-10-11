import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useGameAudioEvents } from "../hooks/use-game-audio-events";
const state = vi.hoisted(() => ({ character: { id: "a", level: 1 }, play: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.character }) }));
vi.mock("@/lib/game", () => ({ q: { character: () => ({}) } }));
vi.mock("@/lib/game-audio", () => ({ playGameSound: state.play }));
beforeEach(() => {
  state.character = { id: "a", level: 1 };
  state.play.mockClear();
});
it("plays only for a confirmed increase on the same character", () => {
  const { rerender } = renderHook(useGameAudioEvents);
  expect(state.play).not.toHaveBeenCalled();
  state.character = { id: "a", level: 2 };
  rerender();
  expect(state.play).toHaveBeenCalledExactlyOnceWith("level-up");
  rerender();
  expect(state.play).toHaveBeenCalledTimes(1);
  state.character = { id: "b", level: 5 };
  rerender();
  expect(state.play).toHaveBeenCalledTimes(1);
  state.character = { id: "b", level: 4 };
  rerender();
  expect(state.play).toHaveBeenCalledTimes(1);
});
