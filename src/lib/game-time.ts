import type { Character } from "@/lib/game";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type GameTime = {
  minute: number;
  hour: number;
  day: number;
  weekday: number;
};

export type DayPeriod = "night" | "dawn" | "day" | "evening";

export const INITIAL_GAME_TIME: GameTime = {
  minute: 0,
  hour: 8,
  day: 1,
  weekday: 0,
};

export function gameTimeFromCharacter(
  character: Pick<Character, "game_time_minute" | "game_time_hour" | "game_day" | "game_weekday">,
): GameTime {
  const { game_time_minute, game_time_hour, game_day, game_weekday } = character;
  if (
    !Number.isInteger(game_time_minute) ||
    game_time_minute < 0 ||
    game_time_minute > 59 ||
    !Number.isInteger(game_time_hour) ||
    game_time_hour < 0 ||
    game_time_hour > 23 ||
    !Number.isInteger(game_day) ||
    game_day < 1 ||
    !Number.isInteger(game_weekday) ||
    game_weekday < 0 ||
    game_weekday >= WEEKDAYS.length
  ) {
    return INITIAL_GAME_TIME;
  }

  return {
    minute: game_time_minute,
    hour: game_time_hour,
    day: game_day,
    weekday: game_weekday,
  };
}

export function advanceGameTime(time: GameTime, elapsedMinutes: number): GameTime {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return time;

  const elapsed = Math.floor(elapsedMinutes);
  const minutesInDay = 24 * 60;
  const totalMinutes = time.hour * 60 + time.minute + elapsed;
  const daysPassed = Math.floor(totalMinutes / minutesInDay);
  const minuteOfDay = totalMinutes % minutesInDay;

  return {
    minute: minuteOfDay % 60,
    hour: Math.floor(minuteOfDay / 60),
    day: time.day + daysPassed,
    weekday: (time.weekday + daysPassed) % WEEKDAYS.length,
  };
}

export function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

export function formatGameTime(time: GameTime) {
  const hour12 = time.hour % 12 || 12;
  const minute = String(time.minute).padStart(2, "0");
  const period = time.hour < 12 ? "AM" : "PM";
  return `${hour12}:${minute} ${period}`;
}
