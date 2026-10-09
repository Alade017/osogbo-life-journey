import { useEffect, useState } from "react";
import {
  Activity,
  BedDouble,
  BookOpen,
  CirclePause,
  CirclePlay,
  RotateCcw,
  Users,
} from "lucide-react";
import { useGameTime } from "@/components/game/GameTimeProvider";
import {
  ACTION_CATALOG,
  NEED_NAMES,
  NEED_RULES,
  statusForNeed,
  type LifeActionId,
} from "@/lib/life-simulation";
import { formatGameTime, WEEKDAYS } from "@/lib/game-time";

const NEED_ICONS: Record<(typeof NEED_NAMES)[number], string> = {
  hunger: "🍲",
  energy: "⚡",
  hygiene: "🫧",
  bladder: "💧",
  fun: "🎈",
  social: "🤝",
};

export function LifeSimulationPanel() {
  const { simulation, pause, resume, setSpeed, queue, startNext, start, complete, interrupt } =
    useGameTime();
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState<string | null>(
    simulation.currentAction?.requestId ?? null,
  );
  const [furniture, setFurniture] = useState<string[]>([]);
  useEffect(() => {
    const refreshFurniture = () => {
      try {
        const home = JSON.parse(
          window.localStorage.getItem("osogbo-life-housing-v1") ?? "null",
        ) as { furniture?: { itemId?: string }[] } | null;
        setFurniture([
          ...new Set((home?.furniture ?? []).flatMap((item) => (item.itemId ? [item.itemId] : []))),
        ]);
      } catch {
        setFurniture([]);
      }
    };
    refreshFurniture();
    window.addEventListener("storage", refreshFurniture);
    window.addEventListener("osogbo-life-home-changed", refreshFurniture);
    return () => {
      window.removeEventListener("storage", refreshFurniture);
      window.removeEventListener("osogbo-life-home-changed", refreshFurniture);
    };
  }, []);
  const doAction = (action: LifeActionId) => {
    const id = `${action}-${crypto.randomUUID()}`;
    const error = start(action, id, { furniture });
    if (error) {
      setMessage(error);
      return;
    }
    setRequestId(id);
    setMessage(`${ACTION_CATALOG[action].name} started.`);
  };
  const finishAction = () => {
    const id = requestId ?? simulation.currentAction?.requestId;
    if (!id) return;
    const outcome = simulation.currentAction
      ? ACTION_CATALOG[simulation.currentAction.actionId].outcome
      : "Activity complete.";
    const error = complete(id);
    setMessage(error ?? `${outcome} Needs and game clock updated.`);
    if (!error) setRequestId(null);
  };
  const runQueue = () => {
    const error = startNext();
    if (error) setMessage(error);
    else {
      setRequestId(simulation.currentAction?.requestId ?? null);
      setMessage("Next queued activity started.");
    }
  };

  return (
    <section className="life-simulation-panel" aria-label="Life simulation">
      <header className="life-simulation-head">
        <div>
          <p className="home-interior-eyebrow">LIFE SIMULATION</p>
          <h2>How you’re doing</h2>
          <p>
            {simulation.character.name} · {WEEKDAYS[simulation.gameTime.weekday]}, Day{" "}
            {simulation.gameTime.day} · {formatGameTime(simulation.gameTime)}
          </p>
        </div>
        <div className="simulation-clock-controls">
          <button
            type="button"
            onClick={() => (simulation.paused ? resume() : pause())}
            aria-label={simulation.paused ? "Resume simulation" : "Pause simulation"}
          >
            {simulation.paused ? <CirclePlay /> : <CirclePause />}
            <span>{simulation.paused ? "Resume" : "Pause"}</span>
          </button>
          <label>
            Speed
            <select
              aria-label="Simulation speed"
              value={simulation.timeSpeed}
              onChange={(event) => setSpeed(Number(event.target.value) as 0.5 | 1 | 2)}
            >
              <option value={0.5}>½×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
        </div>
      </header>
      <div className="life-needs-grid">
        {NEED_NAMES.map((name) => {
          const value = simulation.needs[name];
          const status = statusForNeed(name, value);
          return (
            <div
              className={`life-need is-${status}`}
              key={name}
              aria-label={`${NEED_RULES[name].label}: ${Math.round(value)} percent, ${status}`}
            >
              <span aria-hidden="true">{NEED_ICONS[name]}</span>
              <span className="life-need-label">{NEED_RULES[name].label}</span>
              <strong>{Math.round(value)}%</strong>
              <div className="life-need-track">
                <i style={{ width: `${value}%` }} />
              </div>
              <small>
                {status === "critical"
                  ? "Critical"
                  : status === "warning"
                    ? "Needs attention"
                    : "Healthy"}
              </small>
            </div>
          );
        })}
      </div>
      <div className="simulation-mood">
        <Activity size={17} />
        <span>
          <strong>{simulation.mood.mood}</strong>
          <small>{simulation.mood.reason}</small>
        </span>
      </div>
      <div className="simulation-activities" aria-label="Available activities">
        {!simulation.currentAction ? (
          <>
            <button type="button" onClick={() => doAction("eat")} disabled={simulation.paused}>
              <span>🍲</span>Eat
            </button>
            <button type="button" onClick={() => doAction("study")} disabled={simulation.paused}>
              <BookOpen size={16} />
              Study
            </button>
            <button
              type="button"
              onClick={() => doAction("socialize")}
              disabled={simulation.paused}
            >
              <Users size={16} />
              Socialize
            </button>
            <button
              type="button"
              onClick={() => {
                queue(["study", "socialize"]);
                setMessage("Study and socialize added to your action queue.");
              }}
              disabled={simulation.paused}
            >
              <BedDouble size={16} />
              Queue 2 actions
            </button>
            {simulation.locationType === "home" &&
              (["sleep", "cook", "shower", "toilet", "watch_tv"] as const).map((action) => {
                const definition = ACTION_CATALOG[action];
                const available =
                  !definition.requiredFurniture || furniture.includes(definition.requiredFurniture);
                return (
                  <button
                    key={action}
                    type="button"
                    title={
                      !available
                        ? `Place a ${definition.requiredFurniture} in your home first.`
                        : definition.name
                    }
                    onClick={() => doAction(action)}
                    disabled={simulation.paused || !available}
                  >
                    {definition.name}
                  </button>
                );
              })}
            {simulation.queuedActions.length > 0 && (
              <button type="button" onClick={runQueue} disabled={simulation.paused}>
                Start next ({simulation.queuedActions.length})
              </button>
            )}
            {simulation.pendingEvents.length > 0 && (
              <p className="simulation-message" role="status">
                {simulation.pendingEvents.at(-1)}
              </p>
            )}
          </>
        ) : (
          <>
            <span
              className={`simulation-avatar-state animation-${simulation.currentAction.animation}`}
            >
              <Activity size={16} />
              {ACTION_CATALOG[simulation.currentAction.actionId].name}
            </span>
            <button type="button" onClick={finishAction}>
              Complete activity
            </button>
            <button
              type="button"
              onClick={() => {
                interrupt(simulation.currentAction?.requestId);
                setRequestId(null);
                setMessage("Activity interrupted. Reserved resources were returned.");
              }}
            >
              <RotateCcw size={15} />
              Cancel
            </button>
          </>
        )}
      </div>
      {simulation.queuedActions.length > 0 && (
        <p className="simulation-queue-summary">
          Queued: {simulation.queuedActions.map((id) => ACTION_CATALOG[id].name).join(" → ")}
        </p>
      )}
      {message && (
        <p className="simulation-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
