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
  PARTY_EVENT_TYPES,
  type HostRequirementInput,
  type PartyEventType,
} from "@/lib/party-service";
import {
  eventWindow,
  partyMoodLabel,
  clampPartyMood,
  validEventStart,
  PARTY_MOOD_START,
  localInputValue,
  quickStartOptions,
  DEFAULT_EVENT_HOURS,
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
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide text-[#8A4B1F]">
                {PARTY_EVENT_TYPES.find((t) => t.id === event.event_type)?.label ?? "Party"}
              </span>
              {event.aso_ebi_colour && (
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 rounded-full border border-border bg-[#2F6B4F]"
                  />
                  Aso Ebi: {event.aso_ebi_colour}
                </span>
              )}
            </p>
            {event.host_character_id === characterId && (
              <HostPartyInvitations accountId={accountId} eventId={event.id} />
            )}
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
  const [eventType, setEventType] = useState<PartyEventType>("owambe_party");
  const [asoEbiColour, setAsoEbiColour] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  // The database needs at least one requirement. Every event sends this default; no UI for it.
  const requirements: HostRequirementInput[] = [
    { kind: "guest", item_or_role: "friends", quantity: 2 },
  ];

  const submit = () => {
    const start = new Date(startsAt);
    const problem = validEventStart(start, new Date());
    if (problem) {
      toast.error(problem);
      return;
    }
    const end = new Date(endsAt);
    if (
      Number.isNaN(end.getTime()) ||
      end <= start ||
      end.getTime() > start.getTime() + 8 * 3600_000
    ) {
      toast.error("The closing time must be after the start and at most 8 hours later.");
      return;
    }
    host.mutate({
      locationId,
      title,
      startsAt: start.toISOString(),
      requirements,
      requestId: newPartyRequestId(),
      eventType,
      asoEbiColour: asoEbiColour.trim() || null,
      endsAt: end.toISOString(),
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
      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-1 font-semibold">Event type</legend>
        <div className="grid grid-cols-2 gap-2">
          {PARTY_EVENT_TYPES.map((type) => (
            <label
              key={type.id}
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 ${
                eventType === type.id
                  ? "border-2 border-[#1B2A4A] bg-card font-bold"
                  : "border-border bg-card"
              }`}
            >
              <input
                type="radio"
                name="party-event-type"
                value={type.id}
                checked={eventType === type.id}
                onChange={() => setEventType(type.id)}
                className="accent-[#1B2A4A]"
              />
              {type.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Aso Ebi colour</span>
        <span className="text-xs text-muted-foreground">
          One cloth in one colour, the same for every guest.
        </span>
        <input
          className="min-h-11 rounded-lg border border-border bg-card px-3"
          value={asoEbiColour}
          maxLength={40}
          placeholder="e.g. Emerald green & gold"
          onChange={(e) => setAsoEbiColour(e.target.value)}
        />
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-1 font-semibold">When does it start?</legend>
        <div className="flex flex-wrap gap-2">
          {quickStartOptions(new Date()).map((option) => {
            const value = localInputValue(option.start);
            const picked = startsAt === value;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={picked}
                className={`min-h-11 rounded-full border px-4 font-semibold ${
                  picked
                    ? "border-[#1B2A4A] bg-[#1B2A4A] text-[#F4EBDD]"
                    : "border-border bg-card text-foreground"
                }`}
                onClick={() => {
                  setStartsAt(value);
                  setEndsAt(
                    localInputValue(
                      new Date(option.start.getTime() + DEFAULT_EVENT_HOURS * 3600_000),
                    ),
                  );
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <label className="grid gap-1 text-sm">
          Or pick a date and time (within 24 hours)
          <input
            type="datetime-local"
            className="min-h-11 rounded-lg border border-border bg-card px-3"
            value={startsAt}
            onChange={(e) => {
              setStartsAt(e.target.value);
              const start = new Date(e.target.value);
              if (!Number.isNaN(start.getTime()))
                setEndsAt(
                  localInputValue(new Date(start.getTime() + DEFAULT_EVENT_HOURS * 3600_000)),
                );
            }}
          />
        </label>
      </fieldset>
      <label className="grid gap-1 text-sm">
        Closes (up to 8 hours after the start)
        <input
          type="datetime-local"
          className="min-h-11 rounded-lg border border-border bg-card px-3"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
        disabled={host.isPending || !title || !startsAt || !endsAt || !asoEbiColour.trim()}
      >
        Schedule event
      </button>
    </form>
  );
}
