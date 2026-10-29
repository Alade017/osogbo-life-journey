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

export const Route = createFileRoute("/_authenticated/_game/profile")({
  head: () => pageMeta("Player Profile", "Your OSUN LIFE character, outfit and progress."),
  component: ProfilePage,
});

export function ProfilePage() {
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
    <div className="profile-page">
      <PageHeader
        eyebrow="Your journey"
        title="Player profile"
        subtitle="Your life, look and progress across Osun."
      />
      <section className="profile-hero game-panel" aria-label="Player identity">
        <div className="profile-portrait-stage">
          <Avatar
            appearance={c.appearance as object}
            gender={c.gender}
            size={142}
            equipment={player.equipment}
          />
        </div>
        <div className="profile-identity">
          <p className="profile-kicker">Level {player.level} resident</p>
          <h2>{player.name}</h2>
          <div className="profile-chip-row">
            <Chip tone="primary">{mood}</Chip>
            <Chip>{c.personality}</Chip>
            <Chip>{occupation}</Chip>
          </div>
          <div className="profile-xp">
            <StatBar
              label={`${xp.toNextLevel} XP to level ${player.level + 1}`}
              value={xp.into}
              max={xp.needed}
              tone="primary"
            />
          </div>
          <Link to="/inventory" className="profile-primary-action">
            <Shirt size={18} aria-hidden="true" /> Edit outfit
          </Link>
        </div>
      </section>
      <section className="profile-glance" aria-label="Life at a glance">
        <article className="profile-glance-card game-panel">
          <span>Wallet</span>
          <strong>{formatNaira(player.cash)}</strong>
          <small>Fictional naira</small>
        </article>
        <article className="profile-glance-card game-panel">
          <span>Energy</span>
          <strong>{player.energy}%</strong>
          <small>{player.energy < 30 ? "Time to rest" : "Ready for the day"}</small>
        </article>
        <article className="profile-glance-card game-panel">
          <span>Mood</span>
          <strong>{mood}</strong>
          <small>{c.happiness}% happiness</small>
        </article>
      </section>
      <div className="profile-columns">
        <section className="profile-story game-panel" aria-labelledby="profile-life-title">
          <h3 id="profile-life-title">Your life</h3>
          <dl>
            <div>
              <dt>
                <BriefcaseBusiness size={16} /> Occupation
              </dt>
              <dd>{occupation}</dd>
            </div>
            <div>
              <dt>
                <MapPin size={16} /> Current district
              </dt>
              <dd>{player.location?.name ?? "Osogbo"}</dd>
            </div>
            <div>
              <dt>
                <Award size={16} /> Reputation
              </dt>
              <dd>{player.reputation}/100</dd>
            </div>
          </dl>
        </section>
        <section
          className="profile-milestones game-panel"
          aria-labelledby="profile-milestones-title"
        >
          <h3 id="profile-milestones-title">Recent milestones</h3>
          {milestones.length ? (
            <ul>
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
            <p>Complete missions to build your story here.</p>
          )}
        </section>
      </div>
      <nav className="profile-actions" aria-label="Profile actions">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("osogbo-open-housing", { detail: { source: "profile" } }),
            )
          }
        >
          <House size={17} /> Find a place
        </button>
        <Link to="/social" search={{ playerId: undefined }}>
          <Users size={17} /> Friends
        </Link>
        <Link to="/settings">
          <Settings2 size={17} /> Settings
        </Link>
      </nav>
      {walletQuery.isError && (
        <p className="profile-data-note">Your wallet is temporarily unavailable.</p>
      )}
    </div>
  );
}
