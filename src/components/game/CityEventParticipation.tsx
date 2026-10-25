import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCityEvents } from "@/hooks/use-city-events";
import { joinCityEventOccurrence } from "@/lib/city-event-service";
import { Button } from "@/components/ui/button";

export function CityEventParticipation({ slug, isHere }: { slug: string; isHere: boolean }) {
  const query = useCityEvents();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const sending = useRef(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const join = useMutation({
    mutationFn: joinCityEventOccurrence,
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cityEvents"] }),
  });
  if (query.isError)
    return (
      <section className="game-panel p-4" aria-label="City events">
        <p role="alert">{query.error.message}</p>
        <Button
          type="button"
          variant="outline"
          disabled={!online || query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh city events
        </Button>
      </section>
    );
  const event = query.data?.events.find((e) => e.locationSlug === slug);
  if (!event) return null;
  async function submit() {
    if (!event || event.status !== "active" || event.joined || !navigator.onLine || sending.current)
      return;
    sending.current = true;
    try {
      await join.mutateAsync(event.occurrenceId);
    } catch {
      /* Show the server error below. */
    } finally {
      sending.current = false;
    }
  }
  return (
    <section
      className="game-panel flex flex-wrap items-center justify-between gap-3 p-4"
      aria-label="Active city event"
    >
      <div>
        <p className="text-xs font-semibold text-primary">
          {event.status === "active"
            ? "HAPPENING NOW"
            : event.status === "upcoming"
              ? "UPCOMING"
              : event.status === "cancelled"
                ? "CANCELLED · HEAVY RAIN"
                : "VENUE UNAVAILABLE"}
        </p>
        <h2 className="font-semibold">{event.title}</h2>
        <p className="text-sm text-muted-foreground">{event.description}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-NG", {
            timeZone: "Africa/Lagos",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(event.startsAt))}
          {" – "}
          {new Intl.DateTimeFormat("en-NG", {
            timeZone: "Africa/Lagos",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(event.endsAt))}{" "}
          Lagos
        </p>
      </div>
      {event.status === "active" && (isHere || event.joined) ? (
        <Button
          type="button"
          disabled={!online || join.isPending || event.joined}
          onClick={() => void submit()}
        >
          {event.joined ? "Joined" : join.isPending ? "Joining…" : "Join event"}
        </Button>
      ) : event.status === "active" ? (
        <p className="text-sm text-muted-foreground">Travel here, then join the event.</p>
      ) : null}
      {!online && (
        <p role="status" className="w-full text-sm">
          Reconnect to join city events.
        </p>
      )}
      {join.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {join.error.message}
        </p>
      )}
    </section>
  );
}
