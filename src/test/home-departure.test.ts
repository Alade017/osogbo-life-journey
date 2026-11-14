import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingDepartureFromHome,
  requestDepartureFromHome,
  runHomeDepartureAfterWalk,
  peekPendingDepartureFromHome,
  takeDepartureFromHome,
  takeDepartureFromHomeWhenReady,
  type HomeDepartureReadiness,
} from "@/lib/home-departure";

const ready: HomeDepartureReadiness = {
  houseAvailable: true,
  isInsideHome: true,
  editing: false,
  busy: false,
  offline: false,
};

afterEach(() => {
  const pending = takeDepartureFromHome();
  if (pending) clearPendingDepartureFromHome(pending);
});

const blockedReadinessCases: Array<[string, Partial<HomeDepartureReadiness>]> = [
  ["house unavailable", { houseAvailable: false }],
  ["player outside the home", { isInsideHome: false }],
  ["editing", { editing: true }],
  ["busy", { busy: true }],
  ["offline", { offline: true }],
];

describe("home departure handoff", () => {
  it.each(blockedReadinessCases)(
    "does not consume a queued request while %s",
    (_label, blocked) => {
      const departure = requestDepartureFromHome({
        locationId: "destination-1",
        mode: "walking",
      });
      expect(takeDepartureFromHomeWhenReady({ ...ready, ...blocked })).toBeNull();
      expect(peekPendingDepartureFromHome()).toBe(departure);
    },
  );

  it("clears only the exact request that failed navigation", () => {
    const older = requestDepartureFromHome({ locationId: "older", mode: "walking" });
    const newer = requestDepartureFromHome({ locationId: "newer", mode: "danfo" });

    expect(clearPendingDepartureFromHome(older)).toBe(false);
    expect(takeDepartureFromHome()).toBe(newer);
  });

  it("does not call the travel RPC when walking to the door fails", async () => {
    const travel = vi.fn(async () => undefined);

    await expect(runHomeDepartureAfterWalk(async () => false, travel)).resolves.toBe(false);
    expect(travel).not.toHaveBeenCalled();
  });

  it("calls the travel RPC exactly once after reaching the door", async () => {
    const travel = vi.fn(async () => undefined);

    await expect(runHomeDepartureAfterWalk(async () => true, travel)).resolves.toBe(true);
    expect(travel).toHaveBeenCalledTimes(1);
  });

  it("propagates a rejected travel RPC after the successful walk", async () => {
    const travel = vi.fn(async () => {
      throw new Error("INSUFFICIENT_FUNDS");
    });

    await expect(runHomeDepartureAfterWalk(async () => true, travel)).rejects.toThrow(
      "INSUFFICIENT_FUNDS",
    );
    expect(travel).toHaveBeenCalledTimes(1);
  });
});
