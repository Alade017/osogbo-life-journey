import { useState } from "react";
import { useMissions } from "@/hooks/use-missions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, BriefcaseBusiness, Gauge, House, MapPin, Settings2, Shirt, Smile, Users } from "lucide-react";
import { q, formatNaira, xpProgress } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";
import { CharacterPreview } from "@/components/3d/CharacterPreview";
import type { Appearance } from "@/game/avatar-appearance";
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
  const xpPercent = xp.needed > 0 ? Math.min(100, Math.round((xp.into / xp.needed) * 100)) : 0;
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
      <header className="pi-masthead">
        <p className="pi-eyebrow">Your journey</p>
        <h1>{player.name}</h1>
        <p className="pi-sub">
          {occupation} · {player.location?.name ?? "Osogbo"}
        </p>
      </header>

      <div className="pi-hero">
        <section className="pi-stage" aria-label="Your character">
          <span className="pi-level">LV {player.level}</span>
          <CharacterPreview
            appearance={c.appearance as unknown as Appearance}
            gender={c.gender}
            equipment={player.equipment}
            label={`${player.name}, level ${player.level}`}
          />
          <div className="pi-xp-label">
            <span>{xp.into} XP</span>
            <span>{xp.toNextLevel} to level {player.level + 1}</span>
          </div>
          <div className="pi-xp" aria-hidden="true">
            <span style={{ width: `${xpPercent}%` }} />
          </div>
          <div className="pi-stage-foot">
            <div>
              <strong>{player.name}</strong>
              <span>
                {mood} · {c.personality}
              </span>
            </div>
            <Link to="/inventory" className="pi-pill pi-pill-primary">
              <Shirt size={16} aria-hidden="true" /> Wardrobe
            </Link>
          </div>
        </section>

        <div className="pi-side">
          <section className="pi-stats" aria-label="Life at a glance">
            <article className="pi-stat">
              <span className="pi-stat-label">Wallet</span>
              <strong className="pi-stat-value">{formatNaira(player.cash)}</strong>
              <small className="pi-stat-hint">Fictional naira</small>
            </article>
            <article className="pi-stat">
              <span className="pi-stat-label">Energy</span>
              <strong className="pi-stat-value">{player.energy}%</strong>
              <small className="pi-stat-hint">
                {player.energy < 30 ? "Time to rest" : "Ready for the day"}
              </small>
            </article>
            <article className="pi-stat">
              <span className="pi-stat-label">Mood</span>
              <strong className="pi-stat-value">{mood}</strong>
              <small className="pi-stat-hint">{c.happiness}% happiness</small>
            </article>
            <article className="pi-stat">
              <span className="pi-stat-label">Reputation</span>
              <strong className="pi-stat-value">{player.reputation}/100</strong>
              <small className="pi-stat-hint">Around Osogbo</small>
            </article>
          </section>

          <div className="pi-segment" role="tablist" aria-label="Profile sections">
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
            className="pi-panel"
          >
            {tab === "life" ? (
              <ul className="pi-rows">
                <li>
                  <span>
                    <BriefcaseBusiness size={17} aria-hidden="true" /> Occupation
                  </span>
                  <strong>{occupation}</strong>
                </li>
                <li>
                  <span>
                    <MapPin size={17} aria-hidden="true" /> District
                  </span>
                  <strong>{player.location?.name ?? "Osogbo"}</strong>
                </li>
                <li>
                  <span>
                    <Award size={17} aria-hidden="true" /> Reputation
                  </span>
                  <strong>{player.reputation}/100</strong>
                </li>
                <li>
                  <span>
                    <Gauge size={17} aria-hidden="true" /> Energy
                  </span>
                  <strong>{player.energy}%</strong>
                </li>
                <li>
                  <span>
                    <Smile size={17} aria-hidden="true" /> Happiness
                  </span>
                  <strong>{c.happiness}%</strong>
                </li>
              </ul>
            ) : milestones.length ? (
              <ol className="pi-timeline">
                {milestones.map((milestone) => (
                  <li key={milestone.id}>
                    <span className="pi-timeline-dot" aria-hidden="true">
                      <Award size={17} />
                    </span>
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
              </ol>
            ) : (
              <p className="pi-note">Complete missions to build your story here.</p>
            )}
          </section>
        </div>
      </div>

      <nav className="pi-quick" aria-label="Profile actions">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("osogbo-open-housing", { detail: { source: "profile" } }),
            )
          }
        >
          <House size={20} aria-hidden="true" /> Find a place
        </button>
        <Link to="/social" search={{ playerId: undefined }}>
          <Users size={20} aria-hidden="true" /> Friends
        </Link>
        <Link to="/settings">
          <Settings2 size={20} aria-hidden="true" /> Settings
        </Link>
      </nav>

      {walletQuery.isError && (
        <p className="pi-note">Your wallet is temporarily unavailable.</p>
      )}
    </div>
  );
}
