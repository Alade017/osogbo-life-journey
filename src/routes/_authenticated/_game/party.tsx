import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { q } from "@/lib/game";
import { HostPartyInvitations, PartyInvitations } from "@/components/game/PartyInvitations";
import { pageMeta } from "@/lib/seo";
import { EmptyState, PageHeader } from "@/components/game/ui";
import { PartyHostResults } from "@/components/game/PartyHostResults";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPartyMood,
  listPartyEvents,
  listPartyVenues,
  newPartyRequestId,
  partyRpc,
  type HostRequirementInput,
} from "@/lib/party-service";
import {
  eventWindow,
  partyMoodLabel,
  clampPartyMood,
  requirementRemaining,
  validEventStart,
  PARTY_MOOD_START,
} from "@/lib/party-mood";
import { PaletteSelect } from "@/components/ui/palette-select";

type Tab = "events" | "invitations";
const TAB_IDS: readonly Tab[] = ["events", "invitations"];

export const Route = createFileRoute("/_authenticated/_game/party")({
  head: () => pageMeta("Party", "Host events, send invitations and join the party."),
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = search["tab"];
    return typeof tab === "string" && (TAB_IDS as readonly string[]).includes(tab)
      ? { tab: tab as Tab }
      : {};
  },
  component: PartyPage,
});

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "events", label: "Events" },
  { id: "invitations", label: "Invitations" },
];

function PartyPage() {
  const search = Route.useSearch();
  return <PartyExperience initialTab={search.tab ?? "events"} />;
}

// Shows the layout straight away; the data fills in when it arrives.
function PartySkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Loading the party">
      <div className="game-panel grid gap-2 p-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 flex-1" />
      </div>
      <div className="game-panel grid gap-3 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="game-panel grid gap-3 p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export function PartyExperience({
  initialTab = "events",
  compact = false,
}: {
  initialTab?: Tab;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const characterId = character?.id ?? null;

  const venues = useQuery({ queryKey: ["partyVenues"], queryFn: listPartyVenues });
  const mood = useQuery({
    queryKey: ["partyMood", characterId],
    queryFn: () => getPartyMood(characterId!),
    enabled: Boolean(characterId),
  });

  if (characterLoading) return <PartySkeleton />;
  if (!character)
    return <EmptyState title="No character yet" body="Create a character to join the party." />;

  const score = mood.data?.score ?? PARTY_MOOD_START;
  const partyError = [venues.error, mood.error].find(Boolean);

  return (
    <div className={compact ? "phone-party-body" : "grid gap-5 pb-28"}>
      {!compact && (
        <PageHeader
          title="Party"
          subtitle="Host events and join invitations in town."
          eyebrow="Nightlife"
        />
      )}
      {partyError && (
        <div className="game-panel grid gap-2 p-4" role="alert">
          <p>Party information could not load: {partyError.message}</p>
          <button
            type="button"
            className="min-h-11 justify-self-start rounded-full border border-border px-4 font-semibold"
            onClick={() => {
              void Promise.all([venues.refetch(), mood.refetch()]);
            }}
          >
            Retry
          </button>
        </div>
      )}

      <section
        className={compact ? "phone-party-mood" : "game-panel grid gap-2 p-4"}
        aria-label="Your mood"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Mood: {partyMoodLabel(score)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {clampPartyMood(score)} / 100
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${clampPartyMood(score)}%` }} />
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Party sections"
        className={compact ? "phone-party-tabs" : "flex gap-2 overflow-x-auto"}
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={
              compact
                ? `phone-party-tab${tab === item.id ? " is-active" : ""}`
                : `min-h-11 rounded-full px-3 text-sm font-semibold ${
                    tab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground border border-border"
                  }`
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "events" && (
        <div className="grid gap-5">
          <PartyHostResults key={character.user_id} userId={character.user_id} />
          <EventsTab
            accountId={character.user_id}
            locationId={character.current_location_id}
            characterId={characterId}
            venues={venues.data ?? []}
          />
        </div>
      )}
      {tab === "invitations" && (
        <PartyInvitations key={character.user_id} accountId={character.user_id} />
      )}
    </div>
  );
}

function useInvalidatingMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  success: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => toast.success(success),
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => qc.invalidateQueries(),
  });
}

function EventsTab({
  accountId,
  locationId,
  characterId,
  venues,
}: {
  accountId: string;
  locationId: string | null;
  characterId: string | null;
  venues: Awaited<ReturnType<typeof listPartyVenues>>;
}) {
  const events = useQuery({ queryKey: ["partyEvents"], queryFn: listPartyEvents });
  const respond = useInvalidatingMutation(partyRpc.respondToEvent, "Thanks for joining the event!");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const visibleEvents = useMemo(
    () =>
      (events.data ?? []).filter(
        (event) => eventWindow(event, now) !== "ended" && eventWindow(event, now) !== "cancelled",
      ),
    [events.data, now],
  );
  const eventCentres = venues.filter((v) => v.venue_kind === "event_center");

  if (events.isLoading) return <PartySkeleton />;
  if (events.isError)
    return (
      <div className="game-panel grid gap-2 p-4" role="alert">
        <p>Events could not load: {events.error.message}</p>
        <button
          type="button"
          className="min-h-11 justify-self-start rounded-full border border-border px-4 font-semibold"
          onClick={() => void events.refetch()}
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="grid gap-5">
      {eventCentres.length > 0 ? (
        <HostForm venues={eventCentres} defaultLocationId={locationId} />
      ) : (
        <p className="text-sm text-muted-foreground">No event centers are open to host at yet.</p>
      )}

      {visibleEvents.length === 0 && (
        <EmptyState title="No events yet" body="Scheduled and live events show up here." />
      )}

      {visibleEvents.map((event) => {
        const phase = eventWindow(event, now);
        return (
          <article key={event.id} className="game-panel grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{event.title}</h2>
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {phase === "live"
                  ? "Live"
                  : `Starts ${new Date(event.starts_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>
            {event.host_character_id === characterId && (
              <HostPartyInvitations accountId={accountId} eventId={event.id} />
            )}
            {event.requirements
              .filter((req) => req.kind === "guest")
              .map((req) => {
                const remaining = requirementRemaining(req);
                const mine = event.host_character_id === characterId;
                return (
                  <div key={req.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      Need {req.item_or_role} guests: {req.fulfilled_count}/{req.quantity}
                    </span>
                    {!mine && remaining > 0 && phase === "live" && (
                      <button
                        type="button"
                        className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ requirementId: req.id, requestId: newPartyRequestId() })
                        }
                      >
                        Take part
                      </button>
                    )}
                  </div>
                );
              })}
          </article>
        );
      })}
    </div>
  );
}

function HostForm({
  venues,
  defaultLocationId,
}: {
  venues: Awaited<ReturnType<typeof listPartyVenues>>;
  defaultLocationId: string | null;
}) {
  const host = useInvalidatingMutation(partyRpc.hostEvent, "Your event is scheduled.");
  const [locationId, setLocationId] = useState(
    venues.find((v) => v.location_id === defaultLocationId)?.location_id ??
      venues[0]?.location_id ??
      "",
  );
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [requirements, setRequirements] = useState<HostRequirementInput[]>([
    { kind: "guest", item_or_role: "friends", quantity: 2 },
  ]);

  const submit = () => {
    const start = new Date(startsAt);
    const problem = validEventStart(start, new Date());
    if (problem) {
      toast.error(problem);
      return;
    }
    host.mutate({
      locationId,
      title,
      startsAt: start.toISOString(),
      requirements,
      requestId: newPartyRequestId(),
    });
  };

  return (
    <form
      className="game-panel grid gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="font-display text-lg font-semibold">Host an event</h2>
      <label className="grid gap-1 text-sm">
        Event center
        <PaletteSelect
          value={locationId}
          onValueChange={setLocationId}
          options={venues.map((venue) => ({ value: venue.location_id, label: venue.name }))}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Title
        <input
          className="min-h-11 rounded-lg border border-border bg-card px-3"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Start (within 24 hours)
        <input
          type="datetime-local"
          className="min-h-11 rounded-lg border border-border bg-card px-3"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </label>
      <p className="text-sm font-semibold">Requirements</p>
      {requirements.map((req, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto] gap-2 text-sm">
          <span>{req.quantity} guests</span>
          <button
            type="button"
            className="min-h-11 px-3 text-destructive"
            onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50"
          disabled={requirements.length >= 5}
          onClick={() =>
            setRequirements([
              ...requirements,
              { kind: "guest", item_or_role: "friends", quantity: 2 },
            ])
          }
        >
          Add guest requirement
        </button>
      </div>
      <button
        type="submit"
        className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
        disabled={host.isPending || !title || !startsAt || requirements.length === 0}
      >
        Schedule event
      </button>
    </form>
  );
}
