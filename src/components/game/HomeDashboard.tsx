import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, MapPin } from "lucide-react";
import { formatNaira } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import "@/components/game/home-dashboard-view.css";

export function HomeDashboard({
  player,
  location,
  unread,
  children,
}: {
  player: PlayerState;
  location: string;
  unread: number;
  children: ReactNode;
}) {
  return (
    <section className="home-dashboard" aria-label="Player dashboard">
      <div className="hd-stage">
        {children}
        <header className="hd-status" aria-label="Player status">
          <div className="hd-area">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hd-area-copy">
              <strong className="truncate">{location}</strong>
              <small>Level {player.level}</small>
            </span>
          </div>

          <div className="hd-status-actions">
            <Link
              to="/notifications"
              className="hd-icon-button"
              aria-label={`Notifications, ${unread} unread`}
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" aria-hidden="true" />
              {unread > 0 && (
                <span className="hd-notification-dot">{unread > 9 ? "9+" : unread}</span>
              )}
            </Link>
            <Link
              to="/wallet"
              className="hd-balance"
              aria-label={`Wallet ${formatNaira(player.cash)}`}
            >
              {formatNaira(player.cash)}
            </Link>
          </div>
        </header>
      </div>
    </section>
  );
}
