import { describe, expect, it } from "vitest";
import {
  advanceGameTime,
  formatGameTime,
  gameTimeFromCharacter,
  getDayPeriod,
  INITIAL_GAME_TIME,
  WEEKDAYS,
} from "@/lib/game-time";

describe("game clock", () => {
  it("starts at Monday, Day 1 at 8:00 AM", () => {
    expect(INITIAL_GAME_TIME).toEqual({ minute: 0, hour: 8, day: 1, weekday: 0 });
    expect(WEEKDAYS[INITIAL_GAME_TIME.weekday]).toBe("Monday");
    expect(formatGameTime(INITIAL_GAME_TIME)).toBe("8:00 AM");
  });

  it("reads its persisted clock from the character record", () => {
    expect(
      gameTimeFromCharacter({
        game_time_minute: 32,
        game_time_hour: 8,
        game_day: 14,
        game_weekday: 0,
      }),
    ).toEqual({ minute: 32, hour: 8, day: 14, weekday: 0 });
  });

  it("uses the starting clock when persisted fields are not available", () => {
    expect(gameTimeFromCharacter({} as Parameters<typeof gameTimeFromCharacter>[0])).toEqual(
      INITIAL_GAME_TIME,
    );
  });

  it("advances by travel minutes and rolls over weekday and day", () => {
    const current = { minute: 55, hour: 23, day: 7, weekday: 6 };

    expect(advanceGameTime(current, 10)).toEqual({
      minute: 5,
      hour: 0,
      day: 8,
      weekday: 0,
    });
    expect(formatGameTime(advanceGameTime(current, 10))).toBe("12:05 AM");
  });

  it("does not advance for invalid or non-positive durations", () => {
    expect(advanceGameTime(INITIAL_GAME_TIME, 0)).toBe(INITIAL_GAME_TIME);
    expect(advanceGameTime(INITIAL_GAME_TIME, -5)).toBe(INITIAL_GAME_TIME);
    expect(advanceGameTime(INITIAL_GAME_TIME, Number.NaN)).toBe(INITIAL_GAME_TIME);
  });

  it("classifies day and night periods", () => {
    expect(getDayPeriod(3)).toBe("night");
    expect(getDayPeriod(6)).toBe("dawn");
    expect(getDayPeriod(13)).toBe("day");
    expect(getDayPeriod(18)).toBe("evening");
    expect(getDayPeriod(22)).toBe("night");
  });
});
