import { describe, expect, it } from "vitest";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import {
  activeCityEvents,
  adjustedTripMinutes,
  dayPhaseAt,
  isPowerOutageAt,
  nextCityEvent,
  trafficAt,
  travelConditionAdjustment,
  weatherForDay,
} from "@/lib/world-simulation";

describe("deterministic Osogbo world conditions", () => {
  it("derives lighting phases directly from the simulation clock", () => {
    expect(dayPhaseAt({ ...INITIAL_GAME_TIME, hour: 5, minute: 30 })).toBe("sunrise");
    expect(dayPhaseAt({ ...INITIAL_GAME_TIME, hour: 12 })).toBe("day");
    expect(dayPhaseAt({ ...INITIAL_GAME_TIME, hour: 17, minute: 30 })).toBe("sunset");
    expect(dayPhaseAt({ ...INITIAL_GAME_TIME, hour: 22 })).toBe("night");
  });

  it("keeps weather deterministic across reloads and its SQL seed schedule", () => {
    for (let day = 1; day < 40; day++) {
      expect(weatherForDay(day)).toBe(weatherForDay(day));
      expect(weatherForDay(day)).toBe(weatherForDay(day, 1107));
    }
    expect(weatherForDay(15)).toBe("heavy-rain");
    expect(weatherForDay(14)).toBe("sunny");
  });

  it("adds exactly one predictable traffic and weather adjustment to travel time", () => {
    const rush = { ...INITIAL_GAME_TIME, hour: 8, weekday: 1 };
    expect(trafficAt(rush)).toBe("heavy");
    expect(travelConditionAdjustment("car", rush, "heavy-rain")).toMatchObject({
      traffic: "heavy",
      minutesMultiplier: 1.45,
    });
    expect(adjustedTripMinutes(10, "car", rush)).toBe(14);
    expect(adjustedTripMinutes(10, "walking", { ...rush, day: 14, hour: 11 })).toBe(10);
  });

  it("activates events only in their configured window and returns a next event", () => {
    const marketDay = { ...INITIAL_GAME_TIME, weekday: 2, hour: 9 };
    expect(activeCityEvents(marketDay).map((event) => event.id)).toContain("market-day");
    expect(activeCityEvents({ ...marketDay, hour: 16 })).toEqual([]);
    expect(nextCityEvent({ ...marketDay, hour: 10 })?.id).toBe("riverlight-gathering");
    const rainyEvening = { ...INITIAL_GAME_TIME, day: 15, weekday: 4, hour: 18 };
    expect(activeCityEvents(rainyEvening).map((event) => event.id)).toEqual([
      "riverlight-gathering",
    ]);
  });

  it("runs short power outages on a fixed in-game schedule", () => {
    expect(isPowerOutageAt({ ...INITIAL_GAME_TIME, day: 6, hour: 19 })).toBe(true);
    expect(isPowerOutageAt({ ...INITIAL_GAME_TIME, day: 6, hour: 20 })).toBe(false);
    expect(isPowerOutageAt({ ...INITIAL_GAME_TIME, day: 7, hour: 19 })).toBe(false);
  });
});
