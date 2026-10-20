import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Briefcase, Clock3, MapPin } from "lucide-react";
import { Avatar } from "@/components/game/Avatar";
import { NeedsRing } from "@/components/game/NeedsRing";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { formatNaira, q } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import { ACTION_CATALOG } from "@/lib/life-simulation";
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

      <div className="hd-stage">{children}</div>

      <footer className="hd-bottom" aria-label="Today's tasks and shortcuts">
        <div className="hd-avatar-group">
          <NeedsRing>
            <Link
              to="/profile"
              className="hd-avatar-bubble"
              aria-label={`${player.name}, view profile`}
            >
              <Avatar
                appearance={player.avatar as object}
                gender={player.gender}
                size={52}
                equipment={player.equipment}
              />
            </Link>
          </NeedsRing>
        </div>

        <TaskPill />

        <Link to="/jobs" className="hd-desk-card" aria-label="My desk, jobs and work">
          <Briefcase className="h-5 w-5" aria-hidden="true" />
          <span className="hd-desk-title">My desk</span>
          <small>Jobs and work</small>
        </Link>
      </footer>
    </section>
  );
}

function TaskPill() {
  const { simulation } = useGameTime();
  const missions = useQuery(q.missions());
  const activeMission = (missions.data ?? []).find(
    (playerMission) => playerMission.status === "in_progress" && playerMission.mission,
  );

  if (simulation.currentAction) {
    const action = ACTION_CATALOG[simulation.currentAction.actionId];
    return (
      <div className="hd-task" role="status">
        <span className="hd-task-title">{action?.name ?? "Activity"} in progress</span>
        <span className="hd-task-bar" aria-hidden="true">
          <span className="hd-task-fill is-indeterminate" />
        </span>
      </div>
    );
  }

  if (activeMission?.mission) {
    const target = Math.max(1, activeMission.mission.target);
    const current = Math.max(0, Math.min(activeMission.progress, target));
    const percent = Math.round((current / target) * 100);
    return (
      <Link
        to="/jobs"
        className="hd-task"
        aria-label={`Task waiting: ${activeMission.mission.title}`}
      >
        <span className="hd-task-title">Task waiting!</span>
        <span className="hd-task-sub">{activeMission.mission.title}</span>
        <span className="hd-task-bar" aria-hidden="true">
          <span className="hd-task-fill" style={{ width: `${percent}%` }} />
        </span>
      </Link>
    );
  }

  if (simulation.queuedActions.length > 0) {
    return (
      <Link to="/jobs" className="hd-task" aria-label="Task waiting">
        <span className="hd-task-title">Task waiting!</span>
        <span className="hd-task-sub">{simulation.queuedActions.length} queued</span>
      </Link>
    );
  }

  return (
    <Link to="/jobs" className="hd-task" aria-label="No task waiting, find work">
      <span className="hd-task-title">
        <Clock3 className="inline h-4 w-4" aria-hidden="true" /> No task waiting
      </span>
      <span className="hd-task-sub">Find work to get started</span>
    </Link>
  );
}
