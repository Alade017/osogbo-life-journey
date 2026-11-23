import { useId } from "react";
import type { LocationVenueDesign } from "@/lib/location-venue-designs";

type SpecializedVenueFallbackProps = {
  locationName: string;
  venue: LocationVenueDesign;
};

export function SpecializedVenueFallback({ locationName, venue }: SpecializedVenueFallbackProps) {
  const headingId = useId();

  return (
    <section className="game-panel space-y-4 p-4 md:p-6" aria-labelledby={headingId}>
      <header>
        <p className="text-sm text-muted-foreground">{locationName}</p>
        <h2 id={headingId} className="text-xl font-bold">
          {venue.name}
        </h2>
      </header>

      <div role="status" className="space-y-2 rounded-lg border border-edge bg-muted/50 p-4">
        <h3 className="font-semibold">Venue temporarily unavailable</h3>
        <p className="text-sm text-muted-foreground">
          The interior could not be loaded. You can still view the venue information below.
        </p>
      </div>

      <p className="text-sm">{venue.description}</p>

      {venue.fixtures.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Venue features</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {venue.fixtures.map((fixture) => (
              <div key={fixture.id} className="rounded-lg border border-edge p-3">
                <dt className="text-sm font-semibold">{fixture.label}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{fixture.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
