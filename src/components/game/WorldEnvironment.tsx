import { useEffect, useRef } from "react";
import { CalendarDays, CloudRain, Sun, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { formatGameTime } from "@/lib/game-time";
import {
  activeCityEvents,
  dayPhaseAt,
  isPowerOutageAt,
  nextCityEvent,
  weatherForDay,
} from "@/lib/world-simulation";
import { toast } from "sonner";

const WEATHER_LABEL = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  rainy: "Rain",
  "heavy-rain": "Heavy rain",
} as const;

export function WorldEnvironment() {
  const { simulation } = useGameTime();
  const time = simulation.gameTime;
  const phase = dayPhaseAt(time);
  const weather = weatherForDay(time.day);
  const events = activeCityEvents(time, weather);
  const upcoming = nextCityEvent(time);
  const outage = isPowerOutageAt(time);
  const lastAnnouncement = useRef("");

  useEffect(() => {
    const key = `${time.day}:${events.map((event) => event.id).join(",")}:${outage}`;
    if (lastAnnouncement.current && key !== lastAnnouncement.current) {
      for (const event of events)
        toast.message(`${event.title} is happening now in ${event.locationName}.`);
      if (outage)
        toast.message(
          "A short power outage is affecting household lighting and powered appliances.",
        );
      if (!outage && lastAnnouncement.current.endsWith(":true"))
        toast.success("Power has returned to your home.");
      const previousEvents = lastAnnouncement.current.split(":")[1] ?? "";
      if (previousEvents && !events.length) toast.message("The city event has ended.");
    }
    lastAnnouncement.current = key;
  }, [events, outage, time.day]);

  return (
    <div
      className="world-environment"
      data-world-phase={phase}
      data-world-weather={weather}
      aria-label="Current world conditions"
    >
      <span className="world-condition">
        <Sun size={15} />{" "}
        {phase === "sunrise"
          ? "Sunrise"
          : phase === "sunset"
            ? "Sunset"
            : phase === "day"
              ? "Daytime"
              : "Night"}
      </span>
      <span className="world-condition">
        <CloudRain size={15} /> {WEATHER_LABEL[weather]}
      </span>
      {outage && (
        <span className="world-condition world-outage">
          <Zap size={15} /> Home power outage · until 8 PM
        </span>
      )}
      {events.length ? (
        <Link
          className="world-event world-event-upcoming"
          to="/location/$slug"
          params={{ slug: events[0]!.locationSlug }}
          title={events[0]!.participationRule}
        >
          <CalendarDays size={15} /> {events[0]!.title} · {formatGameTime(time)}· Join
        </Link>
      ) : upcoming ? (
        <Link
          className="world-event world-event-upcoming"
          to="/location/$slug"
          params={{ slug: upcoming.locationSlug }}
        >
          <CalendarDays size={15} /> Next: {upcoming.title} · {upcoming.locationName}
        </Link>
      ) : null}
    </div>
  );
}
