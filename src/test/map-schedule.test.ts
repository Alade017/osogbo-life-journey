import { describe, expect, it } from "vitest";
import { mapActivityHours, parseMapSchedule } from "@/lib/map-schedule";

const actionIds = ["market-browse", "club-visit"];

function schedule(
  actions: unknown[] = [
    { id: "market-browse", start: 6, end: 21, open: true },
    { id: "club-visit", start: 18, end: 3, open: false },
  ],
) {
  return {
    sampledAt: "2026-11-01T10:00:00.000Z",
    clock: { day: 305, hour: 11, minute: 0, weekday: 6 },
    actions,
  };
}

describe("map schedule projection", () => {
  it("accepts a complete server snapshot with a matching action set", () => {
    expect(parseMapSchedule(schedule(), actionIds)).toEqual(schedule());
  });

  it.each([
    ["invalid payload", null],
    ["invalid clock", schedule().clock],
    ["duplicate action", schedule([schedule().actions[0], schedule().actions[0]])],
    [
      "unknown action",
      schedule([{ id: "other", start: 0, end: 24, open: true }, schedule().actions[1]]),
    ],
    [
      "fractional hours",
      schedule([{ id: "market-browse", start: 6.5, end: 21, open: true }, schedule().actions[1]]),
    ],
    [
      "invalid open state",
      schedule([{ id: "market-browse", start: 6, end: 21, open: "yes" }, schedule().actions[1]]),
    ],
  ])("rejects %s", (_name, value) => {
    expect(parseMapSchedule(value, actionIds)).toBeUndefined();
  });

  it("formats end-of-day, all-day and overnight hours", () => {
    expect(mapActivityHours(8, 17)).toBe("08:00–17:00");
    expect(mapActivityHours(18, 3)).toBe("18:00–03:00 (next day)");
    expect(mapActivityHours(8, 8)).toBe("All day");
    expect(mapActivityHours(0, 24)).toBe("00:00–24:00");
  });
});
