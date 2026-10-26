import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  claimPartyHostReward,
  partyHostKey,
  readPartyHostResults,
  type PartyHostEvent,
} from "@/lib/party-reward-service";
const reasons: Record<PartyHostEvent["reason"], string> = {
  claimed: "Reward claimed",
  legacy: "Scheduled before party rewards began",
  cancelled: "Event cancelled",
  not_ended: "Results available after the event ends",
  expired: "Claim window ended",
  requirements: "Not all requirements were filled",
  guests: "Needs contributions from two registered guest accounts",
  daily_cap: "Today's party reward has already been used",
  eligible: "Ready to claim",
};
export function PartyHostResults({ userId }: { userId: string }) {
  const client = useQueryClient();
  const mounted = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
  const claim = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (input: { eventId: string; date: string }) => {
      if (!navigator.onLine) throw new Error("Reconnect before claiming.");
      return claimPartyHostReward(input);
    },
    onSuccess: async (receipt) => {
      if (!mounted.current) return;
      if (receipt.newlyAwarded)
        toast.success(
          receipt.reputationDelta
            ? "+1 reputation confirmed."
            : "Party reward recorded. Reputation is already at 100.",
        );
      await Promise.all([
        client.invalidateQueries({ queryKey: partyHostKey(userId) }),
        client.invalidateQueries({ queryKey: ["character"] }),
        client.invalidateQueries({ queryKey: ["partyEvents"] }),
        client.invalidateQueries({ queryKey: ["partyMood"] }),
      ]);
    },
    onError: () => {
      if (mounted.current && navigator.onLine) void results.refetch();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const recovered = results.data?.events.some(
    (event) => event.eventId === claim.variables?.eventId && event.reason === "claimed",
  );
  return (
    <section aria-label="Your party results" className="game-panel grid gap-3 p-4">
      <h2 className="font-display text-lg font-semibold">Your party results</h2>
      <p className="text-sm text-muted-foreground">
        Fill every requirement with contributions from at least two registered guest accounts. Claim
        +1 reputation within seven days after the event ends, up to one event per Lagos day.
        Existing requirement mood rewards are separate.
      </p>
      {!online && <p role="status">Offline. Reconnect to refresh results or claim.</p>}
      {results.isPending && online && <p role="status">Loading party results…</p>}
      {results.isError && (
        <p role="alert">
          Party results are unavailable.{" "}
          <button type="button" disabled={!online} onClick={() => void results.refetch()}>
            Retry results
          </button>
        </p>
      )}
      {results.data && (
        <p className="text-xs text-muted-foreground">
          Last server update:{" "}
          {new Date(results.data.serverTime).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}{" "}
          (Lagos). Reputation is capped at 100.
        </p>
      )}
      {results.data?.events.length === 0 && <p>No recent hosted events.</p>}
      {results.data?.events.map((event) => (
        <article key={event.eventId} className="grid min-w-0 gap-2 border-t border-border pt-3">
          <h3 className="break-words font-semibold">{event.title}</h3>
          <p>
            {event.completed}/{event.requirements} requirements · {event.guests} guest accounts
          </p>
          <p>
            {reasons[event.reason]}
            {event.receipt ? ` · +${event.receipt.reputationDelta} reputation recorded` : ""}
          </p>
          {!event.receipt && (
            <p className="text-sm">
              Claim by{" "}
              {new Date(event.claimUntil).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}{" "}
              (Lagos).
            </p>
          )}
          {event.reason === "eligible" && (
            <button
              type="button"
              className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
              disabled={!online || claim.isPending || results.isError}
              onClick={() => {
                if (submitting.current) return;
                submitting.current = true;
                claim.mutate({ eventId: event.eventId, date: results.data!.date });
              }}
            >
              {claim.isPending ? "Confirming…" : "Claim reputation"}
            </button>
          )}
        </article>
      ))}
      {claim.isError && !recovered && <p role="alert">{claim.error.message}</p>}
    </section>
  );
}
