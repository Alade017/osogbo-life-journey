import { Bell, Coins, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/game/Avatar";
import { formatNaira } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import { Logo } from "@/components/game/Logo";

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
        aria-label="OSUN LIFE home"
      >
        <Logo small />
        <span className="game-hud-brand-copy">
          <strong>OSUN LIFE</strong>
          <small>PLAYER DASHBOARD</small>
        </span>
      </Link>
      <div className="game-hud-top-row" role="group" aria-label="Player dashboard">
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

        <div className="game-hud-location">
          <span className="game-hud-location-icon">
            <MapPin className="h-4 w-4 shrink-0" />
          </span>
          <span className="game-hud-item-copy min-w-0">
            <small>Current area</small>
            <strong className="truncate">{location}</strong>
            <span className="game-hud-location-meta">
              <span>Osogbo · WAT</span> {dateLabel} · {clockLabel}
            </span>
          </span>
        </div>

        <Link
          to="/wallet"
          className="game-hud-balance"
          aria-label={`Wallet ${formatNaira(player.cash)}`}
        >
          <Coins className="h-4 w-4 text-emerald" />
          <span className="game-hud-item-copy">
            <small>Wallet</small>
            <strong>{formatNaira(player.cash)}</strong>
          </span>
        </Link>

        <Link
          to="/notifications"
          className="game-hud-notifications"
          aria-label={`Notifications, ${unread} unread`}
          title={`Notifications${unread > 0 ? ` · ${unread} unread` : ""}`}
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="game-notification-dot">{unread > 9 ? "9+" : unread}</span>
          )}
        </Link>
      </div>
      <div className="hud-live-clock">
        <span>OSOGBO · WAT</span>
        <time>
          {dateLabel} · {clockLabel}
        </time>
      </div>
    </header>
  );
}
