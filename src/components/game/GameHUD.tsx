import { useEffect, useState } from "react";
import { Bell, Coins, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/game/Avatar";
import { formatNaira, xpProgress, type Character } from "@/lib/game";

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
  const [cityClock, setCityClock] = useState({ time: "", day: "" });
  const xp = xpProgress(character.xp);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCityClock({
        time: now.toLocaleTimeString("en-NG", {
          timeZone: "Africa/Lagos",
          hour: "numeric",
          minute: "2-digit",
        }),
        day: now.toLocaleDateString("en-NG", {
          timeZone: "Africa/Lagos",
          weekday: "long",
        }),
      });
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
          <span className="block text-[10px] text-white/60">{cityClock.day || "Osogbo"}</span>
        </span>
      </div>

      <div className="game-hud-time" aria-label={`Osogbo local time ${cityClock.time}`}>
        <span className="block font-display text-sm font-bold tabular-nums">
          {cityClock.time || "--:--"}
        </span>
        <span className="block text-[10px] text-white/60">Osogbo time</span>
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
