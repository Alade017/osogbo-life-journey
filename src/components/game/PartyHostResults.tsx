import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  partyHostKey,
  readPartyHostResults,
  type PartyHostEvent,
} from "@/lib/party-reward-service";

function phaseLabel(reason: PartyHostEvent["reason"]): string {
  if (reason === "not_ended") return "Running now";
  if (reason === "cancelled") return "Cancelled";
  return "Ended";
}

export function PartyHostResults({ userId }: { userId: string }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const results = useQuery({
    queryKey: partyHostKey(userId),
    queryFn: readPartyHostResults,
    enabled: !!userId && online,
    retry: false,
    refetchInterval: 30_000,
  });

  return (
    <section aria-label="Your party results" className="game-panel grid gap-3 p-4">
      <h2 className="font-display text-lg font-semibold">Your party results</h2>
      <p className="text-sm text-muted-foreground">
        What your guests did at the events you hosted. Nothing is paid out yet.
      </p>
      {!online && <p role="status">Offline. Reconnect to refresh results.</p>}
      {results.isPending && online && <p role="status">Loading party results…</p>}
      {results.isError && (
        <p role="alert">
          Party results are unavailable.{" "}
          <button type="button" disabled={!online} onClick={() => void results.refetch()}>
            Retry results
          </button>
        </p>
      )}
      {results.data?.events.length === 0 && <p>No recent hosted events.</p>}
      {results.data?.events.map((event) => (
        <article key={event.eventId} className="grid min-w-0 gap-1 border-t border-border pt-3">
          <h3 className="break-words font-semibold">{event.title}</h3>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8A4B1F]">
            {phaseLabel(event.reason)}
          </p>
          <p className="text-sm">{event.guests} guest accounts</p>
        </article>
      ))}
    </section>
  );
}
