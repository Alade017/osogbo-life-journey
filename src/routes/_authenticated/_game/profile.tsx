import { useState } from "react";
import { useMissions } from "@/hooks/use-missions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, BriefcaseBusiness, House, MapPin, Settings2, Shirt, Users } from "lucide-react";
import { q, formatNaira, xpProgress } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Avatar } from "@/components/game/Avatar";
import { Chip, GameDataUnavailable, LoadingState, PageHeader, StatBar } from "@/components/game/ui";
import { playerStateFromRows } from "@/lib/player-state";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { moodLabel } from "@/lib/profile-service";
import "@/components/game/profile-inventory.css";

export const Route = createFileRoute("/_authenticated/_game/profile")({
  head: () => pageMeta("Player Profile", "Your OSUN LIFE character, outfit and progress."),
  component: ProfilePage,
});

type ProfileTab = "life" | "milestones";

export function ProfilePage() {
  const [tab, setTab] = useState<ProfileTab>("life");
  const characterQuery = useQuery(q.character());
  const walletQuery = useQuery(q.wallet());
  const { data: jobs } = useQuery(q.jobs());
  const { data: locations } = useQuery(q.locations());
  const { data: equipment } = useQuery(q.equipment());
  const { data: missions } = useMissions();

  if (characterQuery.isError)
    return (
      <GameDataUnavailable
        error={characterQuery.error}
        onRetry={() => void characterQuery.refetch()}
        isRetrying={characterQuery.isRefetching}
      />
    );
  if (characterQuery.isLoading || !characterQuery.data || walletQuery.isLoading)
    return <LoadingState />;

  const c = characterQuery.data;
  const player = playerStateFromRows({
    character: c,
    wallet: walletQuery.data,
    location: locations?.find((item) => item.id === c.current_location_id),
    equipment: normalizeEquippedItems(equipment),
  });
  const xp = xpProgress(player.experience);
  const occupation =
    jobs?.find((job) => job.slug === c.occupation_preference)?.name ?? "Exploring options";
  const milestones = (missions ?? [])
    .filter((mission) => mission.completed_at || mission.claimed_at)
    .sort((a, b) =>
      String(b.completed_at ?? b.claimed_at).localeCompare(String(a.completed_at ?? a.claimed_at)),
    )
    .slice(0, 3);
  const mood = moodLabel(c.happiness, c.stress);

  return (
    <div className="pi-page pi-profile">
      <PageHeader
        eyebrow="Your journey"
        title="Player profile"
        subtitle="Your life, look and progress across Osun."
      />

      <section className="pi-hero game-panel" aria-label="Player identity">
        <div className="pi-avatar">
          <Avatar
            appearance={c.appearance as object}
            gender={c.gender}
            size={132}
            equipment={player.equipment}
          />
        </div>
        <div className="pi-hero-copy">
          <p className="pi-kicker">Level {player.level} resident</p>
          <h2>{player.name}</h2>
          <div className="pi-chips">
            <Chip tone="primary">{mood}</Chip>
            <Chip>{c.personality}</Chip>
            <Chip>{occupation}</Chip>
          </div>
          <StatBar
            label={`${xp.toNextLevel} XP to level ${player.level + 1}`}
            value={xp.into}
            max={xp.needed}
            tone="primary"
          />
          <Link to="/inventory" className="pi-button pi-button-primary">
            <Shirt size={18} aria-hidden="true" /> Edit outfit
          </Link>
        </div>
      </section>

      <section className="pi-stats" aria-label="Life at a glance">
        <article className="pi-stat game-panel">
          <span>Wallet</span>
          <strong>{formatNaira(player.cash)}</strong>
          <small>Fictional naira</small>
        </article>
        <article className="pi-stat game-panel">
          <span>Energy</span>
          <strong>{player.energy}%</strong>
          <small>{player.energy < 30 ? "Time to rest" : "Ready for the day"}</small>
        </article>
        <article className="pi-stat game-panel">
          <span>Mood</span>
          <strong>{mood}</strong>
          <small>{c.happiness}% happiness</small>
        </article>
        <article className="pi-stat game-panel">
          <span>Reputation</span>
          <strong>{player.reputation}/100</strong>
          <small>Around Osogbo</small>
        </article>
      </section>

      <div className="pi-tabs" role="tablist" aria-label="Profile sections">
        {(["life", "milestones"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`profile-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="profile-tabpanel"
            onClick={() => setTab(id)}
          >
            {id === "life" ? "Your life" : "Milestones"}
          </button>
        ))}
      </div>

      <section
        id="profile-tabpanel"
        role="tabpanel"
        aria-labelledby={`profile-tab-${tab}`}
        className="pi-panel game-panel"
      >
        {tab === "life" ? (
          <dl className="pi-facts">
            <div>
              <dt>
                <BriefcaseBusiness size={16} aria-hidden="true" /> Occupation
              </dt>
              <dd>{occupation}</dd>
            </div>
            <div>
              <dt>
                <MapPin size={16} aria-hidden="true" /> Current district
              </dt>
              <dd>{player.location?.name ?? "Osogbo"}</dd>
            </div>
            <div>
              <dt>
                <Award size={16} aria-hidden="true" /> Reputation
              </dt>
              <dd>{player.reputation}/100</dd>
            </div>
          </dl>
        ) : milestones.length ? (
          <ul className="pi-milestones">
            {milestones.map((milestone) => (
              <li key={milestone.id}>
                <Award size={17} aria-hidden="true" />
                <span>
                  <strong>Mission completed</strong>
                  <small>
                    {new Date(milestone.completed_at ?? milestone.claimed_at!).toLocaleDateString(
                      "en-NG",
                    )}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pi-note">Complete missions to build your story here.</p>
        )}
      </section>

      <nav className="pi-actions" aria-label="Profile actions">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("osogbo-open-housing", { detail: { source: "profile" } }),
            )
          }
        >
          <House size={18} aria-hidden="true" /> Find a place
        </button>
        <Link to="/social" search={{ playerId: undefined }}>
          <Users size={18} aria-hidden="true" /> Friends
        </Link>
        <Link to="/settings">
          <Settings2 size={18} aria-hidden="true" /> Settings
        </Link>
      </nav>

      {walletQuery.isError && (
        <p className="pi-note">Your wallet is temporarily unavailable.</p>
      )}
    </div>
  );
}
