export const OSOGBO_TIME_ZONE = "Africa/Lagos";

export function osogboHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: OSOGBO_TIME_ZONE,
    }).format(date),
  );
}

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=7.7827&longitude=4.5418&current=temperature_2m,weather_code,is_day&timezone=UTC&forecast_days=1";

export type OsogboWeather = {
  temperature: number;
  code: number;
  isDay: boolean;
  updatedAt: number;
};

export function weatherDescription(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Conditions unavailable";
}

export async function readOsogboWeather(signal?: AbortSignal): Promise<OsogboWeather> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 10_000);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal });
    if (!response.ok) throw new Error("Osogbo weather service unavailable");
    const body = (await response.json()) as {
      current?: {
        temperature_2m?: unknown;
        weather_code?: unknown;
        is_day?: unknown;
        time?: unknown;
      };
    };
    const current = body?.current;
    const updatedAt =
      typeof current?.time === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(current.time)
        ? Date.parse(`${current.time}Z`)
        : NaN;
    if (
      typeof current?.temperature_2m !== "number" ||
      !Number.isFinite(current.temperature_2m) ||
      typeof current.weather_code !== "number" ||
      !Number.isInteger(current.weather_code) ||
      ![0, 1].includes(current.is_day as number) ||
      !Number.isFinite(updatedAt)
    )
      throw new Error("Invalid Osogbo weather response");
    return {
      temperature: current.temperature_2m,
      code: current.weather_code,
      isDay: current.is_day === 1,
      updatedAt,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
