import { Bell, Coins, Droplets, Heart, MapPin, Utensils, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/game/Avatar";
import { formatNaira, xpProgress } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import { formatGameTime, getDayPeriod, WEEKDAYS } from "@/lib/game-time";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { Logo } from "@/components/game/Logo";
import { getHudVitals } from "@/lib/hud-service";

const VITAL_ICONS = { health: Heart, energy: Zap, hunger: Utensils, thirst: Droplets };

export function GameHUD({
  player,
  location,
  unread,
}: {
  player: PlayerState;
  location: string;
  unread: number;
}) {
  const { gameTime } = useGameTime();
  const clockLabel = formatGameTime(gameTime);
  const weekday = WEEKDAYS[gameTime.weekday] ?? WEEKDAYS[0];
  const dayPeriod = getDayPeriod(gameTime.hour);
  const xp = xpProgress(player.experience);
  const vitals = getHudVitals(player);

  return (
    <header className="game-hud" aria-label="Player status">
      <Link to="/home" className="game-hud-brand" aria-label="OSOGBO LIFE home">
        <Logo small />
      </Link>
      <Link to="/profile" className="game-hud-player" aria-label={`${player.name}, view profile`}>
        <span className="game-hud-avatar">
          <Avatar appearance={player.avatar as object} gender={player.gender} size={36} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold">{player.name}</span>
          <span className="block text-[11px] text-muted-foreground">Level {player.level}</span>
          <span className="game-hud-vitals" aria-label="Player needs">
            {vitals.map(({ name, value, label }) => {
              const Icon = VITAL_ICONS[name];
              return (
                <span key={name} title={label}>
                  <Icon aria-hidden="true" />
                  {value ?? "—"}
                </span>
              );
            })}
          </span>
        </span>
      </Link>

      <div className="game-hud-xp" aria-label={`${xp.into} of ${xp.needed} XP to next level`}>
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <span>Level {player.level}</span>
          <span>
            {xp.into}/{xp.needed} XP
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full bg-emerald" style={{ width: `${xp.pct}%` }} />
        </div>
      </div>

      <Link
        to="/wallet"
        className="game-hud-balance"
        aria-label={`Wallet ${formatNaira(player.cash)}`}
      >
        <Coins className="h-4 w-4 text-emerald" />
        <span>{formatNaira(player.cash)}</span>
      </Link>

      <div className="game-hud-location">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold">{location}</span>
          <span className="block text-[10px] text-muted-foreground">
            {weekday} | Day {gameTime.day}
          </span>
        </span>
      </div>

      <div className="game-hud-time" aria-label={`Osogbo game time ${clockLabel}`}>
        <span className="block font-display text-sm font-bold tabular-nums">{clockLabel}</span>
        <span className="block text-[10px] capitalize text-muted-foreground">{dayPeriod}</span>
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
