import type { GameTime } from "@/lib/game-time";

export const WORLD_CONFIG = {
  sunriseHour: 6,
  sunsetHour: 18,
  eventSeed: 1107,
  rainMoodPenalty: 2,
  powerOutage: { enabled: true, everyDays: 6, startHour: 19, durationHours: 1 },
} as const;

export type Weather = "sunny" | "cloudy" | "rainy" | "heavy-rain";
export type Traffic = "light" | "moderate" | "heavy";
export type DayPhase = "sunrise" | "day" | "sunset" | "night";

export function weatherForDay(day: number, seed = WORLD_CONFIG.eventSeed): Weather {
  const value = (((Math.trunc(day) + seed) % 17) + 17) % 17;
  if (value === 0) return "heavy-rain";
  if (value <= 3) return "rainy";
  if (value <= 7) return "cloudy";
  return "sunny";
}

export function dayPhaseAt(time: GameTime): DayPhase {
  const hour = time.hour + time.minute / 60;
  if (hour >= 5 && hour < WORLD_CONFIG.sunriseHour) return "sunrise";
  if (hour >= WORLD_CONFIG.sunriseHour && hour < 17) return "day";
  if (hour >= 17 && hour < WORLD_CONFIG.sunsetHour) return "sunset";
  return "night";
}

export function trafficAt(time: GameTime): Traffic {
  const busyHour = (time.hour >= 7 && time.hour < 10) || (time.hour >= 16 && time.hour < 19);
  if (!busyHour) return "light";
  return time.weekday >= 5 ? "moderate" : "heavy";
}

export function travelConditionAdjustment(
  mode: string,
  time: GameTime,
  weather = weatherForDay(time.day),
) {
  const roadMode = mode !== "walking";
  const traffic = roadMode ? trafficAt(time) : "light";
  const trafficPercent = traffic === "heavy" ? 0.25 : traffic === "moderate" ? 0.1 : 0;
  const weatherPercent =
    weather === "heavy-rain" && roadMode ? 0.2 : weather === "rainy" && roadMode ? 0.1 : 0;
  const weatherMinutes =
    mode === "walking" ? (weather === "heavy-rain" ? 4 : weather === "rainy" ? 2 : 0) : 0;
  return {
    traffic,
    weather,
    extraMinutes: weatherMinutes,
    minutesMultiplier: 1 + trafficPercent + weatherPercent,
    explanation:
      traffic === "heavy"
        ? "Heavy traffic is slowing the main roads."
        : traffic === "moderate"
          ? "Roads are moderately busy."
          : weather === "heavy-rain" || weather === "rainy"
            ? "Rain is adding a little time to this trip."
            : null,
  };
}

export function adjustedTripMinutes(baseMinutes: number, mode: string, time: GameTime) {
  const conditions = travelConditionAdjustment(mode, time);
  return Math.max(
    1,
    Math.ceil(baseMinutes * conditions.minutesMultiplier) + conditions.extraMinutes,
  );
}

export function isPowerOutageAt(time: GameTime) {
  const { enabled, everyDays, startHour, durationHours } = WORLD_CONFIG.powerOutage;
  return (
    enabled &&
    time.day % everyDays === 0 &&
    time.hour >= startHour &&
    time.hour < startHour + durationHours
  );
}

export type CityEvent = {
  id: string;
  title: string;
  description: string;
  locationSlug: string;
  locationName: string;
  weekday: number | null;
  startHour: number;
  endHour: number;
  kind: "market" | "community" | "culture";
  outdoors: boolean;
  participationRule: string;
};

export const CITY_EVENTS: readonly CityEvent[] = [
  {
    id: "market-day",
    title: "Oja Oba Market Day",
    description: "A lively market day with extra stalls and neighbours out shopping.",
    locationSlug: "oja-oba",
    locationName: "Oja Oba",
    weekday: 2,
    startHour: 9,
    endHour: 16,
    kind: "market",
    outdoors: true,
    participationRule: "Travel to Oja Oba during the event window.",
  },
  {
    id: "riverlight-gathering",
    title: "Riverlight Community Gathering",
    description: "A fictional evening of music, food, and neighbourly conversation.",
    locationSlug: "cultural-district",
    locationName: "Cultural District",
    weekday: 4,
    startHour: 17,
    endHour: 21,
    kind: "community",
    outdoors: false,
    participationRule: "Travel to the Cultural District and visit during the gathering.",
  },
  {
    id: "weekend-arts",
    title: "Open Courtyard Arts",
    description: "A fictional open-air showcase by local artists and makers.",
    locationSlug: "cultural-district",
    locationName: "Cultural District",
    weekday: 5,
    startHour: 14,
    endHour: 19,
    kind: "culture",
    outdoors: true,
    participationRule: "Visit the Cultural District during the showcase.",
  },
];

export function activeCityEvents(time: GameTime, weather = weatherForDay(time.day)): CityEvent[] {
  return CITY_EVENTS.filter(
    (event) =>
      (event.weekday === null || event.weekday === time.weekday) &&
      time.hour >= event.startHour &&
      time.hour < event.endHour &&
      !(event.outdoors && weather === "heavy-rain"),
  );
}

export function nextCityEvent(time: GameTime): CityEvent | null {
  const upcoming = CITY_EVENTS.map((event) => {
    let daysAway = event.weekday === null ? 0 : (event.weekday - time.weekday + 7) % 7;
    if (daysAway === 0 && event.startHour <= time.hour) daysAway = 7;
    return {
      event,
      minutesAway: daysAway * 1440 + event.startHour * 60 - time.hour * 60 - time.minute,
    };
  }).sort((a, b) => a.minutesAway - b.minutesAway);
  return upcoming[0]?.event ?? null;
}
