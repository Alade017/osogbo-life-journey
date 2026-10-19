import type { ReactNode } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Briefcase, Clock3, MapPin, Plus, Sun, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/game/Avatar";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { formatNaira, q } from "@/lib/game";
import type { PlayerState } from "@/lib/player-state";
import { ACTION_CATALOG, type MoodName } from "@/lib/life-simulation";
import "@/components/game/home-dashboard-view.css";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE, readOsogboWeather, weatherDescription } from "@/lib/osogbo-weather";
import { disableGameAudio, enableGameAudio, isGameAudioActive } from "@/lib/game-audio";

const MOOD_DISPLAY: Record<MoodName, { emoji: string; tone: "positive" | "neutral" | "negative" }> =
  {
    happy: { emoji: "\u{1F604}", tone: "positive" },
    confident: { emoji: "\u{1F60E}", tone: "positive" },
    "socially fulfilled": { emoji: "\u{1F970}", tone: "positive" },
    bored: { emoji: "\u{1F610}", tone: "neutral" },
    hungry: { emoji: "\u{1F60B}", tone: "neutral" },
    tired: { emoji: "\u{1F634}", tone: "negative" },
    stressed: { emoji: "\u{1F623}", tone: "negative" },
    embarrassed: { emoji: "\u{1F633}", tone: "negative" },
  };

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
  const now = useLiveClock();
  const clockLabel = now
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "--:--";
  const { simulation } = useGameTime();
  const mood = MOOD_DISPLAY[simulation.mood.mood] ?? MOOD_DISPLAY.happy;

  return (
    <section className="home-dashboard" aria-label="Player dashboard">
      <header className="hd-status" aria-label="Player status">
        <div className="hd-status-main">
          <p className="hd-time-row">
            <Sun className="hd-sun h-5 w-5" aria-hidden="true" />
            <time dateTime={now?.toISOString()}>{clockLabel}</time>
            <span className="hd-separator" aria-hidden="true">
              ·
            </span>
            <span className={`hd-mood is-${mood.tone}`}>
              <span aria-hidden="true">{mood.emoji}</span>
              {capitalise(simulation.mood.mood)}
            </span>
          </p>
          <p className="hd-sub-row">
            <span className="hd-live-dot" aria-hidden="true" />
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">{location}</span>
            <span className="hd-separator" aria-hidden="true">
              ·
            </span>
            <span>Level {player.level}</span>
          </p>
        </div>

        <div className="hd-status-actions">
          <AudioToggle />
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
            <span>{formatNaira(player.cash)}</span>
          </Link>
          <Link to="/wallet" className="hd-add-button" aria-label="Open wallet to add funds">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="hd-stage">{children}</div>

      <footer className="hd-bottom" aria-label="Today's tasks and shortcuts">
        <div className="hd-avatar-group">
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
          <WeatherLabel />
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

function AudioToggle() {
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? false : isGameAudioActive(),
  );
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      className="hd-icon-button"
      aria-pressed={enabled}
      aria-label={enabled ? "Turn game sound off" : "Turn game sound on"}
      title={enabled ? "Sound on" : "Sound off"}
      onClick={() => {
        if (enabled) {
          void disableGameAudio();
          setEnabled(false);
          return;
        }
        void enableGameAudio().then(setEnabled);
      }}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
    </button>
  );
}

function WeatherLabel() {
  const weather = useQuery({
    queryKey: ["osogboLiveWeather"],
    queryFn: ({ signal }) => readOsogboWeather(signal),
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });
  const current = weather.data;
  if (!current) return null;
  return (
    <span className="hd-bubble-label">
      {Math.round(current.temperature)}°C · {weatherDescription(current.code)}
    </span>
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
      <div className="hd-task is-working" role="status">
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
