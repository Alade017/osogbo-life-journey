import { useEffect, useId, useRef, useState } from "react";
import {
  Droplets,
  Smile,
  Sparkles,
  Utensils,
  Users,
  Zap,
} from "lucide-react";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import type { PlayerState } from "@/lib/player-state";
import "@/components/game/game-needs-rail.css";

const NEED_ICONS = {
  hunger: Utensils,
  energy: Zap,
  hygiene: Sparkles,
  bladder: Droplets,
  fun: Smile,
  social: Users,
};

export function GameNeedsRail({
  player,
  compact = false,
}: {
  player: PlayerState;
  compact?: boolean;
}) {
  const { simulation, start, busy, ready } = useGameTime();
  const [detailNeed, setDetailNeed] = useState<(typeof NEED_NAMES)[number] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const actionInFlight = useRef(false);
  const rail = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const needs = NEED_NAMES.map((name) => {
    const value = Math.max(0, Math.min(100, Math.round(simulation.needs[name])));
    return { name, value, status: statusForNeed(name, value) };
  });
  const criticalCount = needs.filter((need) => need.status === "critical").length;
  const urgent = needs
    .filter((need) => need.status !== "healthy")
    .sort((a, b) => {
      const priority = { critical: 0, warning: 1, healthy: 2 };
      return priority[a.status] - priority[b.status] || a.value - b.value;
    })[0];
  const selected = needs.find((need) => need.name === detailNeed);
  const needAction = detailNeed
    ? {
        hunger: { label: "Eat a meal", action: "eat" as const },
        energy: { label: "Go home and rest", app: "Home" },
        hygiene: { label: "Go home and shower", app: "Home" },
        bladder: { label: "Go home and use the toilet", app: "Home" },
        fun: { label: "Find something fun", app: "Party" },
        social: { label: "Open your messages", app: "Messages" },
      }[detailNeed]
    : null;

  useEffect(() => {
    const dismissPanels = () => {
      setExpanded(false);
      setDetailNeed(null);
      setActionMessage(null);
    };
    window.addEventListener("osogbo-hud-dismiss-panels", dismissPanels);
    return () => window.removeEventListener("osogbo-hud-dismiss-panels", dismissPanels);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const dismiss = () => {
      setExpanded(false);
      window.dispatchEvent(
        new CustomEvent("osogbo-hud-panel-open", { detail: { open: false } }),
      );
      setDetailNeed(null);
      setActionMessage(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rail.current?.contains(event.target)) dismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const handleNeedAction = async () => {
    if (!needAction || !detailNeed || actionInFlight.current) return;
    setActionMessage(null);
    if ("action" in needAction && needAction.action) {
      if (!ready || busy || simulation.currentAction) {
        setActionMessage("Finish your current activity and wait for the simulation to be ready.");
        return;
      }
      actionInFlight.current = true;
      setSubmitting(true);
      try {
        const error = await start(
          needAction.action,
          "needs-" + needAction.action + "-" + crypto.randomUUID(),
        );
        setActionMessage(error ?? needAction.label + " started.");
      } catch {
        setActionMessage("This activity could not start. Please try again.");
      } finally {
        actionInFlight.current = false;
        setSubmitting(false);
      }
      return;
    }
    setExpanded(false);
    setDetailNeed(null);
    window.dispatchEvent(
      new CustomEvent("osogbo-open-phone-app", { detail: { app: needAction.app } }),
    );
  };

  return (
    <aside
      ref={rail}
      className={`game-needs-rail${expanded ? " is-expanded" : " is-collapsed"}${criticalCount > 0 ? " has-critical" : ""}${compact ? " is-map-compact" : ""}`}
      aria-label={`${player.name}'s needs dashboard${criticalCount ? `, ${criticalCount} critical` : ""}`}
    >
      <button
        ref={toggle}
        type="button"
        className={`game-needs-toggle${urgent ? ` is-${urgent.status}` : ""}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={
          expanded
            ? "Collapse needs panel"
            : `Expand needs panel${criticalCount ? `, ${criticalCount} critical ${criticalCount === 1 ? "need" : "needs"}` : ""}`
        }
        onClick={() => {
          const nextExpanded = !expanded;
          setExpanded(nextExpanded);
          window.dispatchEvent(
            new CustomEvent("osogbo-hud-panel-open", { detail: { open: nextExpanded } }),
          );
          setDetailNeed(null);
          setActionMessage(null);
        }}
      >
        <span className="game-needs-trigger-icon">
          <Zap size={16} aria-hidden="true" />
        </span>
        <span className="game-needs-trigger-copy">
          <strong>Needs</strong>
        </span>
        {urgent && (
          <span className={`game-needs-urgent-pill is-${urgent.status}`}>
            {NEED_RULES[urgent.name].label} · {urgent.value}%
          </span>
        )}
        {criticalCount > 0 && (
          <span className="game-needs-count" aria-hidden="true">
            {criticalCount}
          </span>
        )}
      </button>
      {expanded && (
        <section id={panelId} className="game-needs-panel" aria-label="Character wellbeing">
          <header className="game-needs-panel-header">
            <div>
              <h2>Your wellbeing</h2>
              <p>Choose a need to see what helps.</p>
            </div>
            <span
              className={`game-needs-summary${criticalCount ? " is-critical" : ""}`}
              role="status"
            >
              {criticalCount
                ? `${criticalCount} critical`
                : urgent
                  ? "Needs attention"
                  : "Doing well"}
            </span>
          </header>
          <div className="game-needs-list">
            {needs.map(({ name, value, status }) => {
              const Icon = NEED_ICONS[name];
              return (
                <button
                  key={name}
                  type="button"
                  className={`game-needs-item is-${status}${detailNeed === name ? " is-active" : ""}`}
                  aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}`}
                  aria-pressed={detailNeed === name}
                  onClick={() => {
                    setActionMessage(null);
                    setDetailNeed(detailNeed === name ? null : name);
                  }}
                >
                  <span className="game-needs-item-heading">
                    <Icon size={17} aria-hidden="true" />
                    <span>{NEED_RULES[name].label}</span>
                    <strong>{value}%</strong>
                  </span>
                  <span
                    className="game-needs-meter"
                    role="meter"
                    aria-label={NEED_RULES[name].label}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={value}
                  >
                    <span style={{ width: `${value}%` }} />
                  </span>
                  <span className="game-needs-status">
                    {status === "healthy" ? "Good" : status === "warning" ? "Low" : "Critical"}
                  </span>
                </button>
              );
            })}
          </div>
          {selected && needAction && (
            <div
              className={`game-needs-detail is-${selected.status}`}
              role="region"
              aria-label={`${NEED_RULES[selected.name].label} need status`}
            >
              <p>
                <strong>{NEED_RULES[selected.name].label}</strong>
                <span>
                  {selected.value}% · {selected.status}
                </span>
              </p>
              <button
                type="button"
                className="game-needs-action"
                onClick={() => void handleNeedAction()}
                disabled={
                  submitting ||
                  ("action" in needAction && (busy || !ready || !!simulation.currentAction))
                }
              >
                {submitting ? "Starting…" : needAction.label}
              </button>
              {actionMessage && (
                <p className="game-needs-action-message" role="status">
                  {actionMessage}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </aside>
  );
}
