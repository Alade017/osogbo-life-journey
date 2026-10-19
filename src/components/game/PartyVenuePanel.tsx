import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PartyPopper } from "lucide-react";
import { listPartyVenues } from "@/lib/party-service";

// Shows the party entry point on club and event-center pages.
export function PartyVenuePanel({ locationId }: { locationId: string }) {
  const venues = useQuery({ queryKey: ["partyVenues"], queryFn: listPartyVenues });
  const venue = venues.data?.find((item) => item.location_id === locationId);
  if (!venue) return null;

  if (venue.venue_kind === "club") {
    return (
      <section className="game-panel grid gap-3 p-4" aria-label="Party at this club">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <PartyPopper className="h-5 w-5" aria-hidden="true" /> Party tonight
        </p>
        <p className="text-sm text-muted-foreground">
          Join the crowd on the dance floor, try club nights and stage shows. Drinks are pricey
          here.
        </p>
        <Link
          to="/party"
          search={{ tab: "clubs" }}
          className="min-h-11 rounded-full bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
        >
          Go to the club
        </Link>
      </section>
    );
  }

  return (
    <section className="game-panel grid gap-3 p-4" aria-label="Party at this event center">
      <p className="flex items-center gap-2 font-display text-lg font-semibold">
        <PartyPopper className="h-5 w-5" aria-hidden="true" /> Events
      </p>
      <p className="text-sm text-muted-foreground">
        Host a party for friends and neighbours, or take part in one that is already scheduled.
      </p>
      <Link
        to="/party"
        search={{ tab: "events" }}
        className="min-h-11 rounded-full bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
      >
        Party events
      </Link>
    </section>
  );
}
