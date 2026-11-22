import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AnimationClip, AnimationMixer, Group } from "three";
import { startAnimationInvalidation } from "@/lib/animation-invalidation";

function setup() {
  const mixer = new AnimationMixer(new Group());
  const action = mixer.clipAction(new AnimationClip("open", 2, []));
  const other = mixer.clipAction(new AnimationClip("close", 2, []));
  const invalidate = vi.fn();

  const start = () =>
    startAnimationInvalidation({
      action,
      invalidate,
      fadeSeconds: 0.3,
    });

  const finish = (completed = action) => {
    mixer.dispatchEvent({
      type: "finished",
      action: completed,
      direction: 1,
    });
  };

  return { mixer, action, other, invalidate, start, finish };
}

describe("animation invalidation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("invalidates immediately", () => {
    const { invalidate, start } = setup();
    const cleanup = start();

    expect(invalidate).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("preserves the 30 Hz schedule", () => {
    const { invalidate, start } = setup();
    const cleanup = start();

    vi.advanceTimersByTime(100);

    expect(invalidate).toHaveBeenCalledTimes(4);

    cleanup();
  });

  it("stops after completion and fade", () => {
    const { invalidate, start, finish } = setup();

    start();
    finish();

    vi.advanceTimersByTime(300);
    invalidate.mockClear();

    vi.advanceTimersByTime(1000);

    expect(invalidate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores unrelated completion events", () => {
    const { invalidate, start, finish, other } = setup();
    const cleanup = start();

    finish(other);
    vi.advanceTimersByTime(500);

    expect(invalidate.mock.calls.length).toBeGreaterThan(10);

    cleanup();
  });

  it("stops at the safety timeout", () => {
    const { invalidate, start } = setup();

    start();

    vi.advanceTimersByTime(3300);
    invalidate.mockClear();

    vi.advanceTimersByTime(1000);

    expect(invalidate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes timers and listeners on cleanup", () => {
    const { mixer, start } = setup();
    const removeListener = vi.spyOn(mixer, "removeEventListener");

    const cleanup = start();
    cleanup();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith(
      "finished",
      expect.any(Function),
    );

    removeListener.mockRestore();
  });

  it("isolates interrupted animations", () => {
    const { other, invalidate, start, finish } = setup();
    const cleanup = start();
    cleanup();

    const nextCleanup = startAnimationInvalidation({
      action: other,
      invalidate,
      fadeSeconds: 0.3,
    });

    finish();

    invalidate.mockClear();
    vi.advanceTimersByTime(500);

    expect(invalidate.mock.calls.length).toBeGreaterThan(10);

    nextCleanup();
  });

  it("supports repeated cleanup safely", () => {
    const { start } = setup();
    const cleanup = start();

    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();

    expect(vi.getTimerCount()).toBe(0);
  });
});
