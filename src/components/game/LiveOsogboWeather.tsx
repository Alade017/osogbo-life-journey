import { useQuery } from "@tanstack/react-query";
import { CloudRain, Moon, Sun } from "lucide-react";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE, readOsogboWeather, weatherDescription } from "@/lib/osogbo-weather";

export function LiveOsogboWeather() {
  const now = useLiveClock();
  const weather = useQuery({
    queryKey: ["osogboLiveWeather"],
    queryFn: ({ signal }) => readOsogboWeather(signal),
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });
  const current = weather.data;
  const stale = !!current && !!now && now.getTime() - current.updatedAt > 60 * 60_000;
  const Icon = current && current.code >= 45 ? CloudRain : current?.isDay ? Sun : Moon;
  const updated = current
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(current.updatedAt)
    : "";

  return (
    <span className="world-condition" aria-label="Osogbo live weather">
      {current ? (
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          title={`Open-Meteo current model conditions for Osogbo. Updated ${updated} WAT${stale ? ". Update delayed" : ""}.`}
          className="inline-flex flex-wrap items-center gap-1.5"
        >
          <Icon size={15} aria-hidden="true" />
          Osogbo · {Math.round(current.temperature)}°C · {weatherDescription(current.code)}
          <small>
            · {current.isDay ? "Day" : "Night"} · {updated} WAT{stale ? " · Update delayed" : ""} ·
            Open-Meteo
          </small>
        </a>
      ) : (
        <span role="status">
          {weather.isError ? "Osogbo weather unavailable" : "Loading Osogbo weather…"}
        </span>
      )}
      {weather.isError && (
        <button type="button" disabled={weather.isFetching} onClick={() => void weather.refetch()}>
          Retry weather
        </button>
      )}
    </span>
  );
}
