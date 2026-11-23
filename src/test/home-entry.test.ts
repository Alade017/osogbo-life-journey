import { afterEach, expect, it, vi } from "vitest";
import {
  HOME_ENTRY_WALK_TIMEOUT_MS,
  runHomeEntryWalk,
  type RoomPoint,
} from "@/game/house-navigation";

const path: RoomPoint[] = [
  [0, 0.06, -2],
  [0, 0.06, 0],
];
const doorway: RoomPoint = [0, 0.06, -2];

afterEach(() => {
  vi.useRealTimers();
});

it("keeps the entry walk successful when the character reaches the interior", async () => {
  const cancel = vi.fn();
  const place = vi.fn();
  const walk = vi.fn().mockResolvedValue(true);

  await expect(
    runHomeEntryWalk({ path, walk, cancel, place, fallback: doorway }),
  ).resolves.toBe(true);

  expect(walk).toHaveBeenCalledWith(path);
  expect(cancel).not.toHaveBeenCalled();
  expect(place).not.toHaveBeenCalled();
});

it("cancels a stalled entry walk and restores the character at the doorway", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const place = vi.fn();
  const walk = vi.fn(() => new Promise<boolean>(() => undefined));

  const result = runHomeEntryWalk({
    path,
    walk,
    cancel,
    place,
    fallback: doorway,
    timeoutMs: HOME_ENTRY_WALK_TIMEOUT_MS,
  });

  await vi.advanceTimersByTimeAsync(HOME_ENTRY_WALK_TIMEOUT_MS);

  await expect(result).resolves.toBe(false);
  expect(cancel).toHaveBeenCalledOnce();
  expect(place).toHaveBeenCalledWith(doorway);
});

it("restores the doorway position when movement is interrupted before timeout", async () => {
  const cancel = vi.fn();
  const place = vi.fn();
  const walk = vi.fn().mockResolvedValue(false);

  await expect(
    runHomeEntryWalk({ path, walk, cancel, place, fallback: doorway }),
  ).resolves.toBe(false);

  expect(place).toHaveBeenCalledWith(doorway);
  expect(cancel).not.toHaveBeenCalled();
});
