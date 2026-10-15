import { Bell, CirclePause, CirclePlay, Coins, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/game/Avatar";
import { formatNaira } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import { Logo } from "@/components/game/Logo";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { formatGameTime, WEEKDAYS } from "@/lib/game-time";

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
  const { simulation, pause, resume, setSpeed, ready, busy, syncError, reconnect } = useGameTime();
  const dateLabel = now
    ? new Intl.DateTimeFormat("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "—";
  const clockLabel = now
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "--:--:--";
  return (
    <header className="game-hud hud-v2" aria-label="Player status">
      <Link
        to="/home"
        search={{ visit: undefined }}
        className="game-hud-brand"
        aria-label="OSOGBO LIFE home"
      >
        <Logo small />
        <span className="game-hud-brand-copy">
          <strong>OSOGBO LIFE</strong>
          <small>PLAYER DASHBOARD</small>
        </span>
      </Link>
      <Link to="/profile" className="game-hud-player" aria-label={`${player.name}, view profile`}>
        <span className="game-hud-avatar">
          <Avatar
            appearance={player.avatar as object}
            gender={player.gender}
            size={36}
            equipment={player.equipment}
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold">{player.name}</span>
          <span className="block text-[11px] text-muted-foreground">Level {player.level}</span>
        </span>
      </Link>

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
          <span className="game-hud-location-meta">
            <span>OSOGBO Â· WAT</span> {dateLabel} Â· {clockLabel}
          </span>
        </span>
      </div>

      <div className="game-hud-time" aria-label="Simulation clock">
        <span className="game-hud-item-copy">
          <small>PERSONAL TIME · DAY {simulation.gameTime.day}</small>
          <strong className="tabular-nums">{formatGameTime(simulation.gameTime)}</strong>
          <span>
            {WEEKDAYS[simulation.gameTime.weekday]} · Mood: {simulation.mood.mood} ·{" "}
            {simulation.paused ? "Paused" : "Active play"}
          </span>
        </span>
        <div className="game-hud-simulation-controls">
          <button
            type="button"
            aria-label={simulation.paused ? "Resume simulation" : "Pause simulation"}
            title={simulation.paused ? "Resume simulation" : "Pause simulation"}
            onClick={() => (simulation.paused ? resume() : pause())}
            disabled={!ready || busy}
          >
            {simulation.paused ? <CirclePlay size={14} /> : <CirclePause size={14} />}
          </button>
          <select
            aria-label="Simulation speed"
            title="At 1x, one game minute passes per real minute."
            value={simulation.timeSpeed}
            disabled={!ready || busy}
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
        title={`Notifications${unread > 0 ? ` · ${unread} unread` : ""}`}
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && <span className="game-notification-dot">{unread > 9 ? "9+" : unread}</span>}
      </Link>
      <div className="hud-live-clock">
        <span>OSOGBO · WAT</span>
        <time>
          {dateLabel} · {clockLabel}
        </time>
      </div>
      {(!ready || syncError) && (
        <div className="hud-sync" role="status">
          <span>
            {syncError
              ? `Personal simulation unavailable: ${syncError}`
              : "Connecting personal simulation…"}
          </span>
          {syncError && (
            <button type="button" onClick={reconnect} disabled={busy}>
              Retry connection
            </button>
          )}
        </div>
      )}
    </header>
  );
}
