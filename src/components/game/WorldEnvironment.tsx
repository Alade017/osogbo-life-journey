import { useEffect, useRef } from "react";
import { CalendarDays, Zap } from "lucide-react";
import { LiveOsogboWeather } from "@/components/game/LiveOsogboWeather";
import { Link } from "@tanstack/react-router";
import { useWorldClock } from "@/hooks/use-world-clock";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import { formatGameTime } from "@/lib/game-time";
import { dayPhaseAt, isPowerOutageAt, weatherForDay } from "@/lib/world-simulation";
import { toast } from "sonner";
import { useGameAudioEvents } from "@/hooks/use-game-audio-events";
import { useCityEvents } from "@/hooks/use-city-events";
import { cityEventTransitions, type CityEventOccurrence } from "@/lib/city-event-service";

export function WorldEnvironment() {
  useGameAudioEvents();
  const world = useWorldClock();
  const time = world.data ?? INITIAL_GAME_TIME;
  const phase = dayPhaseAt(time);
  const weather = weatherForDay(time.day);
  const eventQuery = useCityEvents();
  const events = eventQuery.isError
    ? []
    : (eventQuery.data?.events.filter((e) => e.status === "active") ?? []);
  const upcoming = eventQuery.isError
    ? undefined
    : eventQuery.data?.events.find((e) => e.status === "upcoming");
  const outage = isPowerOutageAt(time);
  const lastOutage = useRef<boolean | null>(null);
  const previousEvents = useRef<CityEventOccurrence[] | null>(null);

  useEffect(() => {
    if (!world.data) return;
    if (lastOutage.current !== null && outage !== lastOutage.current) {
      if (outage)
        toast.message(
          "A short power outage is affecting household lighting and powered appliances.",
        );
      if (!outage) toast.success("Power has returned to your home.");
    }
    lastOutage.current = outage;
  }, [outage, world.data]);

  useEffect(() => {
    if (!eventQuery.data || eventQuery.isError) return;
    const next = eventQuery.data.events;
    if (previousEvents.current) {
      const changes = cityEventTransitions(previousEvents.current, next);
      for (const event of changes.started)
        toast.message(`${event.title} is happening now in ${event.locationName}.`);
      for (const event of changes.ended) {
        const status = next.find((e) => e.occurrenceId === event.occurrenceId)?.status;
        toast.message(
          status === "cancelled"
            ? `${event.title} was cancelled due to heavy rain.`
            : status === "unavailable"
              ? `${event.title}'s venue is unavailable.`
              : `${event.title} has ended.`,
        );
      }
    }
    previousEvents.current = next;
  }, [eventQuery.data, eventQuery.isError]);

  if (!world.data)
    return (
      <div className="world-environment" role="status">
        <LiveOsogboWeather />
        {world.isError ? "City conditions unavailable" : "Connecting to the city clock…"}
        {world.isError && (
          <button type="button" onClick={() => void world.refetch()}>
            Retry
          </button>
        )}
      </div>
    );

  return (
    <div
      className="world-environment"
      data-world-phase={phase}
      data-world-weather={weather}
      aria-label="Current world conditions"
    >
      <LiveOsogboWeather />
      <span className="world-clock-label">CITY · {formatGameTime(time)}</span>
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
          title={`Travel to ${events[0]!.locationName}, then join the event.`}
        >
          <CalendarDays size={15} /> {events[0]!.title} · View event →
        </Link>
      ) : upcoming ? (
        <Link
          className="world-event world-event-upcoming"
          to="/location/$slug"
          params={{ slug: upcoming.locationSlug }}
        >
          <CalendarDays size={15} /> Next: {upcoming.title} · {upcoming.locationName}
        </Link>
      ) : (
        <span role="status">
          {eventQuery.isError
            ? "City events unavailable"
            : eventQuery.isPending
              ? "Loading city events…"
              : "No upcoming city events"}
        </span>
      )}
    </div>
  );
}
