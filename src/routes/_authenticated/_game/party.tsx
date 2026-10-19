import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { q, formatNaira } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { joinPartyRoom, type PartyDanceEvent, type PartyPresence } from "@/lib/multiplayer-service";
import { EmptyState, LoadingState, PageHeader } from "@/components/game/ui";
import {
  getActiveClubVisit,
  getDanceCooldown,
  getPartyMood,
  listPartyClubActivities,
  listPartyDrinks,
  type PartyClubActivity,
  listPartyEvents,
  listPartyVenues,
  newPartyRequestId,
  partyRpc,
  type HostRequirementInput,
} from "@/lib/party-service";
import {
  danceCooldownRemaining,
  eventWindow,
  partyMoodLabel,
  clampPartyMood,
  requirementRemaining,
  validEventStart,
  PARTY_MOOD_START,
} from "@/lib/party-mood";

type Tab = "clubs" | "drinks" | "events";
const TAB_IDS: readonly Tab[] = ["clubs", "drinks", "events"];

export const Route = createFileRoute("/_authenticated/_game/party")({
  head: () => pageMeta("Party", "Visit clubs, buy drinks, dance and host events."),
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = search["tab"];
    return typeof tab === "string" && (TAB_IDS as readonly string[]).includes(tab)
      ? { tab: tab as Tab }
      : {};
  },
  component: PartyPage,
});
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "clubs", label: "Clubs" },
  { id: "drinks", label: "Drinks" },
  { id: "events", label: "Events" },
];

// Fictional party NPC dancers at each club (server validates the slug format only).
const CLUB_DANCERS = [
  { slug: "dancer-lola", name: "Lola" },
  { slug: "dancer-tunde", name: "Tunde" },
  { slug: "dancer-ife", name: "Ife" },
];

function PartyPage() {
  const search = Route.useSearch();
  return <PartyExperience initialTab={search.tab ?? "clubs"} />;
}

export function PartyExperience({
  initialTab = "clubs",
  compact = false,
}: {
  initialTab?: Tab;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const activities = useQuery({ queryKey: ["partyActivities"], queryFn: listPartyClubActivities });
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: locations } = useQuery(q.locations());
  const characterId = character?.id ?? null;

  const venues = useQuery({ queryKey: ["partyVenues"], queryFn: listPartyVenues });
  const drinks = useQuery({ queryKey: ["partyDrinks"], queryFn: listPartyDrinks });
  const mood = useQuery({
    queryKey: ["partyMood", characterId],
    queryFn: () => getPartyMood(characterId!),
    enabled: Boolean(characterId),
  });
  const visit = useQuery({
    queryKey: ["partyVisit", characterId],
    queryFn: () => getActiveClubVisit(characterId!),
    enabled: Boolean(characterId),
    refetchInterval: 30_000,
  });
  const cooldown = useQuery({
    queryKey: ["partyCooldown", characterId],
    queryFn: () => getDanceCooldown(characterId!),
    enabled: Boolean(characterId),
  });

  if (characterLoading) return <LoadingState />;
  if (!character)
    return <EmptyState title="No character yet" body="Create a character to join the party." />;

  const score = mood.data?.score ?? PARTY_MOOD_START;
  const visitLocation = locations?.find((l) => l.id === visit.data?.location_id);
  const partyError = [
    venues.error,
    drinks.error,
    activities.error,
    mood.error,
    visit.error,
    cooldown.error,
  ].find(Boolean);

  return (
    <div className={compact ? "grid gap-5 pb-4" : "grid gap-5 pb-28"}>
      {!compact && (
        <PageHeader
          title="Party"
          subtitle="Clubs, drinks, dancing and events in town."
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
              void Promise.all([
                venues.refetch(),
                drinks.refetch(),
                activities.refetch(),
                mood.refetch(),
                visit.refetch(),
                cooldown.refetch(),
              ]);
            }}
          >
            Retry
          </button>
        </div>
      )}

      <section className="game-panel grid gap-2 p-4" aria-label="Your mood">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Mood: {partyMoodLabel(score)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {clampPartyMood(score)} / 100
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${clampPartyMood(score)}%` }} />
        </div>
        {visit.data && (
          <p className="text-sm text-muted-foreground">
            You are at {visitLocation?.name ?? "a club"} until{" "}
            {new Date(visit.data.expires_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        )}
      </section>

      <div role="tablist" aria-label="Party sections" className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground border border-border"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "clubs" && (
        <ClubsTab
          venues={venues.data ?? []}
          visitLocationId={visit.data?.location_id ?? null}
          currentLocationId={character.current_location_id}
          cooldownAt={cooldown.data ?? null}
          activities={activities.data ?? []}
          isLoading={venues.isLoading}
        />
      )}
      {tab === "drinks" && (
        <DrinksTab
          drinks={drinks.data ?? []}
          inClub={Boolean(visit.data) && visit.data?.location_id === character.current_location_id}
          atEventCentre={venues.data?.some(
            (v) =>
              v.venue_kind === "event_center" && v.location_id === character.current_location_id,
          )}
          cash={wallet?.balance ?? 0}
          isLoading={drinks.isLoading}
        />
      )}
      {tab === "events" && (
        <EventsTab
          locationId={character.current_location_id}
          characterId={characterId}
          venues={venues.data ?? []}
        />
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

// Connects to the party room while the player is in a club. Failures are shown
// quietly: dancing still works through the database RPCs when the room is offline.
function usePartyRoom(locationId: string | null) {
  const [people, setPeople] = useState<PartyPresence[]>([]);
  const [lastDance, setLastDance] = useState<PartyDanceEvent | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "offline">("idle");
  const roomRef = useRef<Awaited<ReturnType<typeof joinPartyRoom>> | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    let joined: Awaited<ReturnType<typeof joinPartyRoom>> | null = null;
    setStatus("connecting");
    joinPartyRoom(locationId)
      .then((room) => {
        if (cancelled) {
          void room.leave();
          return;
        }
        joined = room;
        roomRef.current = room;
        room.onMessage("presence", (payload: { people: PartyPresence[] }) =>
          setPeople(payload.people),
        );
        room.onMessage("dance", (event: PartyDanceEvent) => setLastDance(event));
        setStatus("live");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
      roomRef.current = null;
      setPeople([]);
      setLastDance(null);
      setStatus("idle");
      void joined?.leave();
    };
  }, [locationId]);

  const sendDance = (event: PartyDanceEvent) => {
    roomRef.current?.send("dance", event);
  };
  return { people, lastDance, status, sendDance };
}

function ClubsTab({
  venues,
  visitLocationId,
  currentLocationId,
  cooldownAt,
  activities,
  isLoading,
}: {
  venues: Awaited<ReturnType<typeof listPartyVenues>>;
  visitLocationId: string | null;
  currentLocationId: string | null;
  cooldownAt: string | null;
  activities: PartyClubActivity[];
  isLoading: boolean;
}) {
  const joinActivity = useInvalidatingMutation(partyRpc.joinClubActivity, "Enjoy the show!");
  const enter = useInvalidatingMutation(partyRpc.enterClub, "You joined the party.");
  const leave = useInvalidatingMutation(partyRpc.leaveClub, "You left the club.");
  const dance = useInvalidatingMutation(partyRpc.danceWithNpc, "You danced!");
  const room = usePartyRoom(visitLocationId);
  // The room is told about a dance only after the database confirms it.
  const danceWithNpc = (npcSlug: string) => {
    dance
      .mutateAsync({ npcSlug, requestId: newPartyRequestId() })
      .then(() => room.sendDance({ from: "You", partner: "npc", npcSlug }))
      .catch(() => {
        // The mutation already shows the server's message.
      });
  };
  const [now] = useState(() => new Date());
  const cooldownLeft = danceCooldownRemaining(cooldownAt, now);
  const clubs = venues.filter((venue) => venue.venue_kind === "club");

  if (isLoading) return <LoadingState />;
  if (clubs.length === 0)
    return <EmptyState title="No clubs open" body="Clubs will appear here when they open." />;

  return (
    <div className="grid gap-4">
      {clubs.map((club) => {
        const here = club.location_id === currentLocationId;
        const joined = club.location_id === visitLocationId;
        return (
          <article key={club.location_id} className="game-panel grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{club.name}</h2>
              <span className="text-xs text-muted-foreground">18+ · Adults only</span>
            </div>
            {!here && (
              <p className="text-sm text-muted-foreground">
                Travel to this club to join the party.
              </p>
            )}
            {here && !joined && (
              <button
                type="button"
                className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground"
                disabled={enter.isPending}
                onClick={() => enter.mutate(newPartyRequestId())}
              >
                Join the party
              </button>
            )}
            {joined && (
              <>
                <div className="grid gap-2">
                  <p className="text-sm font-semibold">Club nights</p>
                  {activities.map((activity) => (
                    <div
                      key={activity.slug}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <div>
                        <p className="font-semibold">{activity.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.description} {formatNaira(activity.price)} · mood +
                          {activity.mood_effect}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        disabled={joinActivity.isPending}
                        onClick={() =>
                          joinActivity.mutate({
                            activitySlug: activity.slug,
                            requestId: newPartyRequestId(),
                          })
                        }
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-semibold">Dance floor</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {CLUB_DANCERS.map((dancer) => (
                      <button
                        key={dancer.slug}
                        type="button"
                        className="min-h-11 rounded-full border border-border bg-card px-3 text-sm font-semibold disabled:opacity-50"
                        disabled={dance.isPending || cooldownLeft > 0}
                        onClick={() => danceWithNpc(dancer.slug)}
                      >
                        Dance with {dancer.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cooldownLeft > 0
                      ? `Rest ${cooldownLeft}s before the next dance.`
                      : "Dancing lifts your mood."}
                  </p>
                </div>
                <div className="grid gap-1 rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold">
                    {room.status === "live"
                      ? `${room.people.length} ${room.people.length === 1 ? "person" : "people"} in the club`
                      : room.status === "offline"
                        ? "Party room is offline. Dancing still counts."
                        : "Connecting to the party room…"}
                  </p>
                  {room.status === "live" && room.people.length > 0 && (
                    <p className="text-muted-foreground">
                      {room.people.map((person) => person.name).join(", ")}
                    </p>
                  )}
                  {room.lastDance && (
                    <p className="text-muted-foreground" aria-live="polite">
                      {room.lastDance.partner === "npc"
                        ? `${room.lastDance.from} danced with a club dancer.`
                        : `${room.lastDance.from} danced with ${room.lastDance.to}.`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate(newPartyRequestId())}
                >
                  Leave the club
                </button>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function DrinksTab({
  drinks,
  inClub,
  atEventCentre,
  cash,
  isLoading,
}: {
  drinks: Awaited<ReturnType<typeof listPartyDrinks>>;
  inClub: boolean;
  atEventCentre: boolean | undefined;
  cash: number;
  isLoading: boolean;
}) {
  const buy = useInvalidatingMutation(partyRpc.buyDrink, "Drink bought.");
  if (isLoading) return <LoadingState />;
  const canBuy = inClub || Boolean(atEventCentre);
  return (
    <div className="grid gap-3">
      {!canBuy && (
        <p className="text-sm text-muted-foreground">
          Join a club or visit an event center to buy drinks.
        </p>
      )}
      {inClub && (
        <p className="text-sm text-muted-foreground">
          Club prices are high. Event centers sell the same drinks for less.
        </p>
      )}
      {drinks.map((drink) => (
        <div key={drink.slug} className="game-panel flex items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{drink.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatNaira(inClub ? drink.club_price : drink.price)} · mood +{drink.mood_effect}
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
            disabled={!canBuy || buy.isPending || cash < (inClub ? drink.club_price : drink.price)}
            onClick={() => buy.mutate({ drinkSlug: drink.slug, requestId: newPartyRequestId() })}
          >
            Buy
          </button>
        </div>
      ))}
    </div>
  );
}

function EventsTab({
  locationId,
  characterId,
  venues,
}: {
  locationId: string | null;
  characterId: string | null;
  venues: Awaited<ReturnType<typeof listPartyVenues>>;
}) {
  const events = useQuery({ queryKey: ["partyEvents"], queryFn: listPartyEvents });
  const respond = useInvalidatingMutation(partyRpc.respondToEvent, "Thanks for joining the event!");
  const [now] = useState(() => new Date());
  const visibleEvents = useMemo(
    () =>
      (events.data ?? []).filter(
        (event) => eventWindow(event, now) !== "ended" && eventWindow(event, now) !== "cancelled",
      ),
    [events.data, now],
  );
  const eventCentres = venues.filter((v) => v.venue_kind === "event_center");

  if (events.isLoading) return <LoadingState />;
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
            {event.requirements.map((req) => {
              const remaining = requirementRemaining(req);
              const mine = event.host_character_id === characterId;
              return (
                <div key={req.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {req.kind === "drink"
                      ? `Bring a ${req.item_or_role}`
                      : `Need ${req.item_or_role} guests`}
                    : {req.fulfilled_count}/{req.quantity}
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
    { kind: "drink", item_or_role: "chapman", quantity: 2 },
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
        <select
          className="min-h-11 rounded-lg border border-border bg-card px-3"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {venues.map((venue) => (
            <option key={venue.location_id} value={venue.location_id}>
              {venue.name}
            </option>
          ))}
        </select>
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
          <span>
            {req.kind === "drink"
              ? `Bring ${req.quantity} × ${req.item_or_role}`
              : `${req.quantity} guests`}
          </span>
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
            setRequirements([...requirements, { kind: "drink", item_or_role: "zobo", quantity: 1 }])
          }
        >
          Add drink requirement
        </button>
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
