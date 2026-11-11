import { useMissions } from "@/hooks/use-missions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Footprints,
  Handshake,
  House,
  Medal,
  Route as RouteIcon,
  Settings2,
  Shirt,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { q, formatNaira, xpProgress } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";
import { CharacterPreview } from "@/components/3d/CharacterPreview";
import type { Appearance } from "@/game/avatar-appearance";
import { playerStateFromRows } from "@/lib/player-state";
import { EQUIPMENT_SLOTS, normalizeEquippedItems } from "@/lib/equipment-service";
import { moodLabel } from "@/lib/profile-service";
import { profileBadges, type BadgeId } from "@/lib/profile-badges";
import "@/components/game/profile-inventory.css";

export const Route = createFileRoute("/_authenticated/_game/profile")({
  head: () => pageMeta("Player Profile", "Your OSUN LIFE character, outfit and badges."),
  component: ProfilePage,
});

const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  "first-steps": Footprints,
  "mission-runner": Medal,
  trailblazer: RouteIcon,
  "rising-star": Star,
  respected: Handshake,
  "dressed-up": Shirt,
};

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
  const normalizedEquipment = normalizeEquippedItems(equipment);
  const player = playerStateFromRows({
    character: c,
    wallet: walletQuery.data,
    location: locations?.find((item) => item.id === c.current_location_id),
    equipment: normalizedEquipment,
  });
  const xp = xpProgress(player.experience);
  const xpPercent = xp.needed > 0 ? Math.min(100, Math.round((xp.into / xp.needed) * 100)) : 0;
  const occupation =
    jobs?.find((job) => job.slug === c.occupation_preference)?.name ?? "Exploring options";
  const missionsCompleted = (missions ?? []).filter(
    (mission) => mission.completed_at || mission.claimed_at,
  ).length;
  const badges = profileBadges({
    missionsCompleted,
    level: player.level,
    reputation: player.reputation,
    outfitWorn: normalizedEquipment.length,
    outfitSlots: EQUIPMENT_SLOTS.length,
  });
  const earned = badges.filter((badge) => badge.earned).length;
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
            <span>
              {xp.toNextLevel} to level {player.level + 1}
            </span>
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
          <div className="pi-section-heading">
            <div>
              <p className="pi-eyebrow">At a glance</p>
              <h2>Your life</h2>
            </div>
          </div>
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
        </div>
      </div>

      <section className="pi-section" aria-labelledby="profile-badges-title">
        <div className="pi-section-heading">
          <div>
            <p className="pi-eyebrow">Achievements</p>
            <h2 id="profile-badges-title">Badges</h2>
          </div>
          <span>
            {earned} / {badges.length} earned
          </span>
        </div>
        <ul className="pi-badges">
          {badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.id];
            return (
              <li key={badge.id} className={`pi-badge${badge.earned ? " is-earned" : ""}`}>
                <span className="pi-badge-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <strong>{badge.name}</strong>
                <small>{badge.description}</small>
                {badge.earned ? (
                  <span className="pi-badge-state">Earned</span>
                ) : (
                  <span className="pi-badge-progress">
                    <span className="pi-badge-bar" aria-hidden="true">
                      <span style={{ width: `${(badge.progress / badge.target) * 100}%` }} />
                    </span>
                    <span>
                      {badge.progress} / {badge.target}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

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

      {walletQuery.isError && <p className="pi-note">Your wallet is temporarily unavailable.</p>}
    </div>
  );
}
