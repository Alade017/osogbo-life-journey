import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness, CheckCircle2, Heart, Settings2, Sparkles, Target, UserRound, Users, X, Zap,
} from "lucide-react";
import { CharacterPreview } from "@/components/3d/CharacterPreview";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { useMissions } from "@/hooks/use-missions";
import { q } from "@/lib/game";
import { normalizeAvatarAppearance, type Appearance } from "@/game/avatar-appearance";
import type { PlayerState } from "@/lib/player-state";
import { SettingsPage } from "@/routes/_authenticated/_game/settings";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import "@/components/game/player-life-hub.css";

type HubTab = "profile" | "needs" | "goals" | "skills" | "people" | "career" | "settings";
const TABS: Array<{ id: HubTab; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "needs", label: "Needs", icon: Zap },
  { id: "goals", label: "Goals", icon: Target },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "people", label: "People", icon: Users },
  { id: "career", label: "Career", icon: BriefcaseBusiness },
  { id: "settings", label: "Settings", icon: Settings2 },
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

export function PlayerLifeHub({ player, open, initialTab = "profile", onClose }: {
  player: PlayerState; open: boolean; initialTab?: "profile" | "settings"; onClose: () => void;
}) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [expanded, setExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<{ pointerId: number; startY: number; offset: number; moved: boolean } | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const { simulation, ready } = useGameTime();
  const { data: character } = useQuery(q.character());
  const { data: skills } = useQuery(q.playerSkills());
  const { data: relationships } = useQuery(q.npcRelationships());
  const { data: npcs } = useQuery(q.npcs());
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
    setTab(initialTab);
    setExpanded(false);
    setDragOffset(0);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>(".player-hub-close")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        sheet.focus();
        return;
      }

      // Let nested account confirmation dialogs manage their own focus cycle.
      const nestedAlertOpen = document.querySelector('[role="alertdialog"]') !== null;
      const active = document.activeElement;
      if (nestedAlertOpen && active instanceof HTMLElement && !sheet.contains(active)) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (active === first || !(active instanceof HTMLElement) || !sheet.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !(active instanceof HTMLElement) || !sheet.contains(active))) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const activeMissions = (missions ?? []).filter((mission) => !mission.completed_at && !mission.claimed_at);
  const completedMissions = (missions ?? []).filter((mission) => mission.completed_at || mission.claimed_at);
  const skillRows = skills ?? [];
  const relationshipRows = relationships ?? [];
  const npcRows = npcs ?? [];
  const employmentRows = employment ?? [];
  const preferredJob = (jobs ?? []).find((item) => item.slug === character?.occupation_preference);
  const currentEmployment = employmentRows.find((row) => row.is_current);
  const currentJob = (jobs ?? []).find((item) => item.id === currentEmployment?.job_id) ?? preferredJob;

  return (
    <div className="player-hub-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={sheetRef} className={`player-hub-sheet${expanded ? " is-expanded" : ""}`} role="dialog" aria-modal="true" aria-label="Player life hub" style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}>
        <button className="player-hub-grabber" type="button" aria-label="Expand player hub" onClick={() => {
          if (dragRef.current?.moved) {
            dragRef.current = null;
            return;
          }
          setExpanded(true);
        }} onPointerDown={(event) => {
          dragRef.current = { pointerId: event.pointerId, startY: event.clientY, offset: 0, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          drag.offset = event.clientY - drag.startY;
          if (Math.abs(drag.offset) > 8) drag.moved = true;
          setDragOffset(Math.max(-120, Math.min(220, drag.offset)));
        }} onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (drag.offset > 105) onClose();
          else if (drag.offset < -45) setExpanded(true);
          else if (expanded && drag.offset > 35) setExpanded(false);
          if (!drag.moved) dragRef.current = null;
          else dragRef.current = { ...drag, pointerId: -1 };
          setDragOffset(0);
        }} onPointerCancel={() => {
          dragRef.current = null;
          setDragOffset(0);
        }}><span /></button>
        <header className="player-hub-header">
          <div className="player-hub-identity">
            <div className="player-hub-avatar">
              <CharacterPreview appearance={appearance} gender={gender} equipment={player.equipment} label={player.name} framing="head" />
            </div>
            <div className="player-hub-heading">
              <span className="player-hub-eyebrow">YOUR OSOGBO LIFE</span>
              <h2>{player.name}</h2>
              <p>Level {player.level} · {readable(currentJob?.name, "Finding your path")}</p>
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
              <article><span>Location</span><strong>{readable(player.location?.name, "Location unavailable")}</strong></article>
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
            {activeMissions.length ? activeMissions.map((playerMission) => <article className="player-hub-record" key={playerMission.id}>
              <Target size={18} /><div><strong>{readable(playerMission.mission?.title, "Mission")}</strong><p>{readable(playerMission.mission?.description, "Mission details unavailable.")}</p></div><span>In progress</span>
            </article>) : <p className="player-hub-empty">No active missions right now. Check the game objectives for your next challenge.</p>}
            {completedMissions.length > 0 && <p className="player-hub-muted"><CheckCircle2 size={15} /> {completedMissions.length} completed mission{completedMissions.length === 1 ? "" : "s"}</p>}
          </div>}

          {tab === "skills" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Skills & progression</h3><p>Skill levels recorded for your character.</p></div>
            {skillRows.length ? skillRows.map((skill) => {
              const label = skill.skill_slug.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
              return <article className="player-hub-skill" key={skill.id}>
                <div><strong>{label}</strong><span>Level {skill.level} · {skill.experience.toLocaleString("en-NG")} XP</span></div>
              </article>;
            }) : <p className="player-hub-empty">Your skill record is not available yet. Skills will appear here as the game records them.</p>}
          </div>}

          {tab === "people" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Your connections</h3><p>Relationships saved in your neighbourhood life.</p></div>
            <div className="player-hub-summary-strip"><strong>{relationshipRows.length}</strong><span>Relationships</span></div>
            {relationshipRows.length ? relationshipRows.slice(0, 8).map((relation) => {
              const npc = npcRows.find((item) => item.id === relation.npc_id);
              return <article className="player-hub-record" key={relation.id}>
                <Heart size={18} /><div><strong>{readable(npc?.name, "Neighbour")}</strong><p>Friendship {relation.friendship} · Trust {relation.trust}</p></div>
              </article>;
            }) : <p className="player-hub-empty">You have not built any recorded relationships yet. Meet people around Osogbo to get started.</p>}
          </div>}

          {tab === "settings" && <div className="player-hub-settings"><SettingsPage embedded /></div>}

          {tab === "career" && <div className="player-hub-list">
            <div className="player-hub-section-intro"><h3>Career & work</h3><p>Your current occupation and saved employment records.</p></div>
            <article className="player-hub-career-card"><BriefcaseBusiness size={24} /><div><span>{currentEmployment ? "Current occupation" : "Preferred occupation"}</span><strong>{readable(currentJob?.name, "Exploring opportunities")}</strong><p>{readable(currentJob?.description, "Choose a career path to begin building your work life.")}</p></div></article>
            {currentEmployment && <article className="player-hub-record"><CheckCircle2 size={18} /><div><strong>Career level {currentEmployment.career_level}</strong><p>{currentEmployment.times_performed.toLocaleString("en-NG")} completed shifts</p></div></article>}
            <p className="player-hub-note">Career pay and progression continue to be managed by the existing career system.</p>
          </div>}
        </div>
      </section>
    </div>
  );
}
