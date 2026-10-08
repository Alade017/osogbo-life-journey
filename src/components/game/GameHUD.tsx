import { Bell, Coins, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/game/Avatar";
import { formatNaira, xpProgress, type Character } from "@/lib/game";
import { formatGameTime, getDayPeriod, WEEKDAYS } from "@/lib/game-time";
import { useGameTime } from "@/components/game/GameTimeProvider";

export function GameHUD({
  character,
  balance,
  location,
  unread,
}: {
  character: Character;
  balance: number | null | undefined;
  location: string;
  unread: number;
}) {
  const { gameTime } = useGameTime();
  const clockLabel = formatGameTime(gameTime);
  const weekday = WEEKDAYS[gameTime.weekday] ?? WEEKDAYS[0];
  const dayPeriod = getDayPeriod(gameTime.hour);
  const xp = xpProgress(character.xp);

  return (
    <header className="game-hud" aria-label="Player status">
      <Link
        to="/profile"
        className="game-hud-player"
        aria-label={`${character.name}, view profile`}
      >
        <span className="game-hud-avatar">
          <Avatar appearance={character.appearance as object} gender={character.gender} size={36} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold">{character.name}</span>
          <span className="block text-[11px] text-white/65">
            Age {character.age} · Lv {character.level}
          </span>
        </span>
      </Link>

      <div className="game-hud-xp" aria-label={`${xp.into} of ${xp.needed} XP to next level`}>
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-white/65">
          <span>Level {character.level}</span>
          <span>
            {xp.into}/{xp.needed} XP
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
          <span
            className="block h-full rounded-full bg-[#efbd46]"
            style={{ width: `${xp.pct}%` }}
          />
        </div>
      </div>

      <Link to="/wallet" className="game-hud-balance" aria-label={`Wallet ${formatNaira(balance)}`}>
        <Coins className="h-4 w-4 text-[#efbd46]" />
        <span>{formatNaira(balance)}</span>
      </Link>

      <div className="game-hud-location">
        <MapPin className="h-4 w-4 shrink-0 text-[#e7a653]" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold">{location}</span>
          <span className="block text-[10px] text-white/60">
            {weekday} | Day {gameTime.day}
          </span>
        </span>
      </div>

      <div className="game-hud-time" aria-label={`Osogbo game time ${clockLabel}`}>
        <span className="block font-display text-sm font-bold tabular-nums">{clockLabel}</span>
        <span className="block text-[10px] capitalize text-white/60">{dayPeriod}</span>
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
