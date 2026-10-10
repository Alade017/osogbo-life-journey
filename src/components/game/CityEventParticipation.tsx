import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useWorldClock } from "@/hooks/use-world-clock";
import { activeCityEvents } from "@/lib/world-simulation";
import { joinCityEvent } from "@/lib/simulation-service";
import { Button } from "@/components/ui/button";

export function CityEventParticipation({ slug, isHere }: { slug: string; isHere: boolean }) {
  const { data: time } = useWorldClock();
  const [joined, setJoined] = useState<string | null>(null);
  const join = useMutation({ mutationFn: joinCityEvent });
  const event = time && activeCityEvents(time).find((e) => e.locationSlug === slug);
  if (!event) return null;
  const eventKey = `${event.id}:${time.day}`;
  return (
    <section
      className="game-panel flex flex-wrap items-center justify-between gap-3 p-4"
      aria-label="Active city event"
    >
      <div>
        <p className="text-xs font-semibold text-primary">HAPPENING NOW</p>
        <h2 className="font-semibold">{event.title}</h2>
        <p className="text-sm text-muted-foreground">{event.description}</p>
      </div>
      {isHere ? (
        <Button
          disabled={join.isPending || joined === eventKey}
          onClick={() => join.mutate(event.id, { onSuccess: () => setJoined(eventKey) })}
        >
          {joined === eventKey ? "Joined" : join.isPending ? "Joining…" : "Join event"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Travel here, then join the event.</p>
      )}
      {join.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {join.error.message}
        </p>
      )}
    </section>
  );
}
