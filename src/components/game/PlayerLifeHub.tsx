import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness, CheckCircle2, Heart, Sparkles, Target, UserRound, Users, X, Zap,
} from "lucide-react";
import { CharacterPreview } from "@/components/3d/CharacterPreview";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { useMissions } from "@/hooks/use-missions";
import { q } from "@/lib/game";
import { normalizeAvatarAppearance, type Appearance } from "@/game/avatar-appearance";
import type { PlayerState } from "@/lib/player-state";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import "@/components/game/player-life-hub.css";

type HubTab = "profile" | "needs" | "goals" | "skills" | "people" | "career";
const TABS: Array<{ id: HubTab; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "needs", label: "Needs", icon: Zap },
  { id: "goals", label: "Goals", icon: Target },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "people", label: "People", icon: Users },
  { id: "career", label: "Career", icon: BriefcaseBusiness },
];
const NEED_ICONS: Record<(typeof NEED_NAMES)[number], string> = {
  hunger: "🍲", energy: "⚡", hygiene: "🫧", bladder: "🚻", fun: "🎮", social: "💬",
};
function readable(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function PlayerLifeHub({ player, open, onClose }: {
  player: PlayerState; open: boolean; onClose: () => void;
}) {
  const [tab, setTab] = useState<HubTab>("profile");
  const { simulation, ready } = useGameTime();
  const { data: character } = useQuery(q.character());
  const { data: skills } = useQuery(q.playerSkills());
  const { data: relationships } = useQuery(q.npcRelationships());
  const { data: jobs } = useQuery(q.jobs());
  const { data: employment } = useQuery(q.myJobs());
  const { data: missions } = useMissions();
  const gender = player.gender ?? "nonbinary";
  const appearance = useMemo(() => normalizeAvatarAppearance(
    (player.avatar && typeof player.avatar === "object" && !Array.isArray(player.avatar)
      ? player.avatar : {}) as Appearance, gender,
  ), [player.avatar, gender]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const activeMissions = (missions ?? []).filter((mission) => !mission.completed_at && !mission.claimed_at);
  const completedMissions = (missions ?? []).filter((mission) => mission.completed_at || mission.claimed_at);
  const skillRows = (skills ?? []) as Array<Record<string, unknown>>;
  const relationshipRows = (relationships ?? []) as Array<Record<string, unknown>>;
  const employmentRows = (employment ?? []) as Array<Record<string, unknown>>;
  const job = (jobs ?? []).find((item) => item.slug === character?.occupation_preference);
  const currentEmployment = employmentRows.find((row) =>
    row["status"] === "active" || row["is_active"] === true,
  ) ?? employmentRows[0];

  return (
    <div className="player-hub-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="player-hub-sheet" role="dialog" aria-modal="true" aria-label="Player life hub">
        <div className="player-hub-grabber" aria-hidden="true"><span /></div>
        <header className="player-hub-header">
          <div className="player-hub-identity">
            <div className="player-hub-avatar">
              <CharacterPreview appearance={appearance} gender={gender} equipment={player.equipment} label={player.name} framing="head" />
            </div>
            <div className="player-hub-heading">
              <span className="player-hub-eyebrow">YOUR OSOGBO LIFE</span>
              <h2>{player.name}</h2>
              <p>Level {player.level} · {readable(job?.name, "Finding your path")}</p>
            </div>
          </div>
          <button className="player-hub-close" type="button" onClick={onClose} aria-label="Close player hub"><X size={20} /></button>
        </header>

        <nav className="player-hub-tabs" aria-label="Player hub sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className="player-hub-tab" aria-pressed={tab === id} onClick={() => setTab(id)}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="player-hub-content" key={tab}>
          {tab === "profile" && <div className="player-hub-profile">
            <div className="player-hub-character-stage">
              <CharacterPreview appearance={appearance} gender={gender} equipment={player.equipment} label={player.name} />
            </div>
            <div className="player-hub-summary-grid">
              <article><span>Level</span><strong>{player.level}</strong></article>
              <article><span>Cash</span><strong>₦{numberValue(player.cash).toLocaleString("en-NG")}</strong></article>
              <article><span>Reputation</span><strong>{player.reputation}/100</strong></article>
              <article><span>Location</span><strong>{readable(player.location?.name, "Osogbo")}</strong></article>
            </div>
            <p className="player-hub-note">Your equipped appearance is shared with your in-world character.</p>
          </div>}

          {tab === "needs" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Daily wellbeing</h3><p>Live needs from the game simulation.</p></div>
            {!ready && <p className="player-hub-muted">Connecting to your life simulation…</p>}
            {NEED_NAMES.map((name) => {
              const value = Math.max(0, Math.min(100, Math.round(simulation.needs[name])));
              const status = statusForNeed(name, value);
              return <article className="player-hub-need" key={name}>
                <div className="player-hub-need-top"><span>{NEED_ICONS[name]} {NEED_RULES[name].label}</span><strong>{value}%</strong></div>
                <div className="player-hub-meter" role="meter" aria-label={NEED_RULES[name].label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span className={`is-${status}`} style={{ width: `${value}%` }} /></div>
                <small>{status === "healthy" ? "Doing well" : status === "warning" ? "Needs attention" : "Critical"}</small>
              </article>;
            })}
          </div>}

          {tab === "goals" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Your goals</h3><p>Progress from your existing mission records.</p></div>
            <div className="player-hub-summary-strip"><strong>{activeMissions.length}</strong><span>Active</span><strong>{completedMissions.length}</strong><span>Completed</span></div>
            {activeMissions.length ? activeMissions.map((mission) => <article className="player-hub-record" key={mission.id}>
              <Target size={18} /><div><strong>{mission.title}</strong><p>{mission.description}</p></div><span>In progress</span>
            </article>) : <p className="player-hub-empty">No active missions right now. Check the game objectives for your next challenge.</p>}
            {completedMissions.length > 0 && <p className="player-hub-muted"><CheckCircle2 size={15} /> {completedMissions.length} completed mission{completedMissions.length === 1 ? "" : "s"}</p>}
          </div>}

          {tab === "skills" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Skills & progression</h3><p>Skill levels recorded for your character.</p></div>
            {skillRows.length ? skillRows.map((skill, index) => {
              const label = readable(skill["skill_name"] ?? skill["name"] ?? skill["skill"], `Skill ${index + 1}`);
              const level = numberValue(skill["level"]);
              const xp = numberValue(skill["experience"] ?? skill["xp"]);
              const progress = Math.max(0, Math.min(100, numberValue(skill["progress"] ?? skill["progress_percent"])));
              return <article className="player-hub-skill" key={String(skill["id"] ?? label)}>
                <div><strong>{label}</strong><span>Level {level}{xp ? ` · ${xp} XP` : ""}</span></div>
                <div className="player-hub-meter"><span style={{ width: `${progress}%` }} /></div>
              </article>;
            }) : <p className="player-hub-empty">Your skill record is not available yet. Skills will appear here as the game records them.</p>}
          </div>}

          {tab === "people" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Your connections</h3><p>Relationships saved in your neighbourhood life.</p></div>
            <div className="player-hub-summary-strip"><strong>{relationshipRows.length}</strong><span>Relationships</span></div>
            {relationshipRows.length ? relationshipRows.slice(0, 8).map((relation, index) => <article className="player-hub-record" key={String(relation["id"] ?? index)}>
              <Heart size={18} /><div><strong>{readable(relation["npc_name"] ?? relation["name"], "Neighbour")}</strong><p>Friendship {numberValue(relation["friendship"])} · Trust {numberValue(relation["trust"])}</p></div>
            </article>) : <p className="player-hub-empty">You have not built any recorded relationships yet. Meet people around Osogbo to get started.</p>}
          </div>}

          {tab === "career" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Career & work</h3><p>Your current occupation and saved employment records.</p></div>
            <article className="player-hub-career-card"><BriefcaseBusiness size={24} /><div><span>Preferred occupation</span><strong>{readable(job?.name, "Exploring opportunities")}</strong><p>{readable(job?.description, "Choose a career path to begin building your work life.")}</p></div></article>
            {currentEmployment && <article className="player-hub-record"><CheckCircle2 size={18} /><div><strong>{readable(currentEmployment["job_title"] ?? currentEmployment["position"] ?? currentEmployment["role"], "Employment record")}</strong><p>{readable(currentEmployment["status"], "Saved employment")}</p></div></article>}
            <p className="player-hub-note">Career pay and progression continue to be managed by the existing career system.</p>
          </div>}
        </div>
      </section>
    </div>
  );
}
