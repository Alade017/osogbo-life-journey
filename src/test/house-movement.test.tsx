import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useHouseMovement } from "@/hooks/use-house-movement";
let frames: Map<number, FrameRequestCallback>, id: number, now: number;
beforeEach(() => {
  frames = new Map();
  id = 0;
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function tick() {
  now += 50;
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((f) => f(now)));
}
it("keeps its position and resolves false when walking is cancelled", async () => {
  const { result } = renderHook(() => useHouseMovement("room", [0, 0.06, 0]));
  let arrived!: Promise<boolean>;
  act(() => {
    arrived = result.current.walk([
      [1, 0.06, 0],
      [1, 0.06, 1],
    ]);
  });
  tick();
  expect(result.current.walking).toBe(true);
  const position = [...result.current.position];
  act(() => result.current.cancel());
  expect(await arrived).toBe(false);
  tick();
  expect(result.current.walking).toBe(false);
  expect(result.current.position).toEqual(position);
});
it("finishes a route and cancels the previous promise when a new destination is chosen", async () => {
  const { result } = renderHook(() => useHouseMovement("room", [0, 0.06, 0]));
  let first!: Promise<boolean>, second!: Promise<boolean>;
  act(() => {
    first = result.current.walk([[2, 0.06, 0]]);
  });
  tick();
  act(() => {
    second = result.current.walk([
      [0.5, 0.06, 0],
      [0.5, 0.06, 0.5],
    ]);
  });
  expect(await first).toBe(false);
  for (let i = 0; i < 20; i++) tick();
  expect(await second).toBe(true);
  expect(result.current.position).toEqual([0.5, 0.06, 0.5]);
  expect(result.current.walking).toBe(false);
});
it("stops pending walking when the room unmounts so the task cannot start after leaving", async () => {
  const { result, unmount } = renderHook(() => useHouseMovement("room", [0, 0.06, 0]));
  let arrived!: Promise<boolean>;
  act(() => {
    arrived = result.current.walk([[2, 0.06, 0]]);
  });
  unmount();
  expect(await arrived).toBe(false);
  expect(frames.size).toBe(0);
});
