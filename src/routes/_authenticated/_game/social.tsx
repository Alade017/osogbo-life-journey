import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, MessageCircle, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, LoadingState, PageHeader } from "@/components/game/ui";
import { q, rpc } from "@/lib/game";
import { gameTimeFromCharacter } from "@/lib/game-time";
import {
  NPC_CATALOG,
  npcActivityAt,
  relationshipTier,
  socialActionsFor,
  type Relationship,
  type SocialAction,
} from "@/lib/npc-simulation";
import { pageMeta } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_game/social")({
  head: () => pageMeta("People of Osogbo", "Meet neighbours and build lasting relationships."),
  component: SocialPage,
});

const ACTION_LABELS: Record<SocialAction, string> = {
  greet: "Say hello",
  work: "Ask about work",
  events: "Discuss local events",
  interests: "Share interests",
  joke: "Share a joke",
  compliment: "Offer a compliment",
  help: "Offer help",
  invite: "Invite to an event",
  romance: "Express interest",
  end: "End conversation",
};

function SocialPage() {
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const { data: npcRowsData, isLoading: npcsLoading } = useQuery(q.npcs());
  const { data: locationsData } = useQuery(q.locations());
  const { data: relationshipsData } = useQuery({ ...q.npcRelationships(), enabled: !!character });
  const { data: eventsData } = useQuery({ ...q.npcEvents(), enabled: !!character });
  const npcRows = npcRowsData ?? [];
  const locations = locationsData ?? [];
  const relationships = relationshipsData ?? [];
  const events = eventsData ?? [];
  const qc = useQueryClient();
  const interact = useMutation({
    mutationFn: rpc.interactWithNpc,
    onSuccess: (result) => {
      toast[result.accepted ? "success" : "message"](result.message);
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["npcRelationships"] }),
        qc.invalidateQueries({ queryKey: ["npcEvents"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (characterLoading || npcsLoading || !character) return <LoadingState />;
  const time = gameTimeFromCharacter(character);
  const placeBySlug = (slug: string) =>
    locations.find((location) => location.slug === slug) ?? null;
  const relationByNpc = new Map<string, Relationship>(
    relationships.map((relation) => [
      relation.npc_id,
      {
        friendship: relation.friendship,
        romance: relation.romance,
        trust: relation.trust,
        conflict: relation.conflict,
        meetings: relation.meetings,
        lastInteractionDay: relation.last_interaction_day,
        lastInteractionText: relation.last_interaction_text,
      },
    ]),
  );
  const eventsByNpc = new Map<string, typeof events>();
  for (const event of events) if (!eventsByNpc.has(event.npc_id)) eventsByNpc.set(event.npc_id, []);
  for (const event of events) eventsByNpc.get(event.npc_id)?.push(event);

  return (
    <div className="space-y-5">
      <PageHeader
        title="People of Osogbo"
        subtitle="Familiar faces keep their own routines. Meet them where the day takes them."
      />
      <section
        className="game-panel flex flex-wrap items-center justify-between gap-3 p-4"
        aria-label="Social simulation guidance"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-leaf/10 p-2 text-leaf">
            <Users size={20} />
          </span>
          <p className="max-w-2xl text-sm text-muted-foreground">
            NPCs follow the city clock. Travel to their current district to start a conversation.
            Friendships grow through repeat encounters; trust and romance unlock gradually.
          </p>
        </div>
        <Chip tone="primary">
          {time.hour.toString().padStart(2, "0")}:{time.minute.toString().padStart(2, "0")} · Day{" "}
          {time.day}
        </Chip>
      </section>
      {npcRows.length === 0 ? (
        <EmptyState title="No neighbours yet" body="Check back when people arrive in town." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Neighbour directory">
          {NPC_CATALOG.filter((npc) => npcRows.some((row) => row.id === npc.id)).map(
            (catalogNpc) => {
              const npcRow = npcRows.find((row) => row.id === catalogNpc.id);
              if (!npcRow) return null;
              const npc = {
                ...catalogNpc,
                name: npcRow.name,
                role: npcRow.role,
                personality: npcRow.personality as typeof catalogNpc.personality,
                interests: npcRow.interests,
                topics: npcRow.topics,
              };
              const relation = relationByNpc.get(npc.id) ?? {
                friendship: 0,
                romance: 0,
                trust: 0,
                conflict: 0,
                meetings: 0,
                lastInteractionDay: null,
                lastInteractionText: null,
              };
              const activity = npcActivityAt(npc, time, (slug) => placeBySlug(slug)?.id ?? null);
              const destination = placeBySlug(activity.destinationSlug);
              const canMeet = !!destination && character.current_location_id === destination.id;
              const availableActions = socialActionsFor(relation, canMeet && activity.available);
              const history = eventsByNpc.get(npc.id) ?? [];
              return (
                <article key={npc.id} className="game-panel space-y-4 p-5">
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl font-semibold">{npc.name}</h2>
                        <Chip>{relationshipTier(relation)}</Chip>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {npc.role} · {npc.occupation}
                      </p>
                    </div>
                    <span className="rounded-full bg-sun/20 p-2 text-clay">
                      <MessageCircle size={20} />
                    </span>
                  </header>
                  <p className="text-sm">
                    <span className="font-medium">Right now:</span> {activity.label}
                    {destination ? ` at ${destination.name}` : " nearby"}
                    {!activity.available ? " · not available for a chat" : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <RelationshipBar label="Friendship" value={relation.friendship} />
                    <RelationshipBar label="Trust" value={relation.trust} />
                    <RelationshipBar label="Romance" value={relation.romance} icon="heart" />
                    <RelationshipBar label="Conflict" value={relation.conflict} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {npc.interests.map((interest) => (
                      <Chip key={interest}>{interest}</Chip>
                    ))}
                  </div>
                  {canMeet && activity.available ? (
                    <div className="flex flex-wrap gap-2" aria-label={`Talk with ${npc.name}`}>
                      {availableActions.map((action) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={action === "end" ? "outline" : "default"}
                          disabled={interact.isPending}
                          onClick={() =>
                            interact.mutate({
                              npcId: npc.id,
                              action,
                              requestId: crypto.randomUUID(),
                            })
                          }
                        >
                          {ACTION_LABELS[action]}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <MapPin size={16} /> Meet at {destination?.name ?? "their current district"}
                      </span>
                      <Link
                        to="/map"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Open city map
                      </Link>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 text-sm">
                    <p className="mb-2 flex items-center gap-2 font-medium">
                      <Sparkles size={15} /> {npc.topics[time.day % npc.topics.length]}
                    </p>
                    {history.length ? (
                      <ul className="space-y-1 text-muted-foreground">
                        {history.slice(0, 2).map((event) => (
                          <li key={event.id}>{event.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">
                        No conversations yet. A friendly hello is a good start.
                      </p>
                    )}
                    {relation.meetings > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last: {relation.lastInteractionText ?? "You met"} · {relation.meetings}{" "}
                        encounter{relation.meetings === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </article>
              );
            },
          )}
        </section>
      )}
    </div>
  );
}

function RelationshipBar({ label, value, icon }: { label: string; value: number; icon?: "heart" }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon === "heart" && <Heart size={12} />}
        {label}
      </span>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium">{value}/100</span>
    </div>
  );
}
