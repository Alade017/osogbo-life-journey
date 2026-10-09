import {
  Bell,
  CirclePause,
  CirclePlay,
  Coins,
  Activity,
  MapPin,
  Smile,
  Sparkles,
  Utensils,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/game/Avatar";
import { formatNaira, xpProgress } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import { useLiveClock } from "@/hooks/use-live-clock";
import { Logo } from "@/components/game/Logo";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { formatGameTime, WEEKDAYS } from "@/lib/game-time";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";

const VITAL_ICONS = {
  hunger: Utensils,
  energy: Zap,
  hygiene: Sparkles,
  bladder: Activity,
  fun: Smile,
  social: Users,
};

export function GameHUD({
  player,
  location,
  unread,
}: {
  player: PlayerState;
  location: string;
  unread: number;
}) {
  const now = useLiveClock();
  const { simulation, pause, resume, setSpeed } = useGameTime();
  const dateLabel = now
    ? new Intl.DateTimeFormat("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Africa/Lagos",
      }).format(now)
    : "—";
  const clockLabel = now
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone: "Africa/Lagos",
      }).format(now)
    : "--:--:--";
  const xp = xpProgress(simulation.experience);

  return (
    <header className="game-hud" aria-label="Player status">
      <Link to="/home" className="game-hud-brand" aria-label="OSOGBO LIFE home">
        <Logo small />
        <span className="game-hud-brand-copy">
          <strong>OSOGBO LIFE</strong>
          <small>PLAYER DASHBOARD</small>
        </span>
      </Link>
      <Link to="/profile" className="game-hud-player" aria-label={`${player.name}, view profile`}>
        <span className="game-hud-avatar">
          <Avatar appearance={player.avatar as object} gender={player.gender} size={36} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold">{player.name}</span>
          <span className="block text-[11px] text-muted-foreground">Level {player.level}</span>
          <span className="game-hud-vitals" aria-label="Player needs">
            {NEED_NAMES.map((name) => {
              const Icon = VITAL_ICONS[name];
              return (
                <span
                  key={name}
                  title={`${NEED_RULES[name].label} ${Math.round(simulation.needs[name])}% · ${statusForNeed(name, simulation.needs[name])}`}
                >
                  <Icon aria-hidden="true" />
                  {Math.round(simulation.needs[name])}
                </span>
              );
            })}
          </span>
        </span>
      </Link>

      <div className="game-hud-xp" aria-label={`${xp.into} of ${xp.needed} XP to next level`}>
        <div className="game-hud-xp-label">
          <span>LEVEL PROGRESS</span>
          <strong>
            {xp.into}
            <small> / {xp.needed} XP</small>
          </strong>
        </div>
        <div className="game-hud-xp-track">
          <span style={{ width: `${xp.pct}%` }} />
        </div>
      </div>

      <Link
        to="/wallet"
        className="game-hud-balance"
        aria-label={`Wallet ${formatNaira(player.cash)}`}
      >
        <Coins className="h-4 w-4 text-emerald" />
        <span className="game-hud-item-copy">
          <small>WALLET</small>
          <strong>{formatNaira(player.cash)}</strong>
        </span>
      </Link>

      <div className="game-hud-location">
        <span className="game-hud-location-icon">
          <MapPin className="h-4 w-4 shrink-0" />
        </span>
        <span className="game-hud-item-copy min-w-0">
          <small>CURRENT AREA</small>
          <strong className="truncate">{location}</strong>
          <span>{dateLabel}</span>
        </span>
      </div>

      <div className="game-hud-time" aria-label="Simulation clock">
        <span className="game-hud-item-copy">
          <small>GAME TIME · DAY {simulation.gameTime.day}</small>
          <strong className="tabular-nums">{formatGameTime(simulation.gameTime)}</strong>
          <span>
            {WEEKDAYS[simulation.gameTime.weekday]} · {dateLabel} · Local {clockLabel}
          </span>
        </span>
        <div className="game-hud-simulation-controls">
          <button
            type="button"
            aria-label={simulation.paused ? "Resume simulation" : "Pause simulation"}
            title={simulation.paused ? "Resume simulation" : "Pause simulation"}
            onClick={() => (simulation.paused ? resume() : pause())}
          >
            {simulation.paused ? <CirclePlay size={14} /> : <CirclePause size={14} />}
          </button>
          <select
            aria-label="Simulation speed"
            value={simulation.timeSpeed}
            onChange={(event) => setSpeed(Number(event.target.value) as 0.5 | 1 | 2)}
          >
            <option value={0.5}>½×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </div>
      </div>

      <Link
        to="/notifications"
        className="game-hud-notifications"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && <span className="game-notification-dot">{unread > 9 ? "9+" : unread}</span>}
      </Link>
    </header>
  );
}
