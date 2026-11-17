import { useState } from "react";
import { Droplets, Plus, Smile, Sparkles, Utensils, Users, X, Zap } from "lucide-react";
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

/**
 * Needs panel: one rounded pill of six needs. Hiding slides the pill off the
 * left edge and leaves a small tab that brings it back.
 */
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
  const [expanded, setExpanded] = useState(!compact);
  const criticalCount = NEED_NAMES.filter(
    (name) => statusForNeed(name, Math.round(simulation.needs[name])) === "critical",
  ).length;
  const detailValue = detailNeed ? Math.round(simulation.needs[detailNeed]) : null;
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

  const handleNeedAction = async () => {
    if (!needAction || !detailNeed) return;
    setActionMessage(null);
    if ("action" in needAction && needAction.action) {
      if (!ready || busy || simulation.currentAction) {
        setActionMessage("Finish your current activity and wait for the simulation to be ready.");
        return;
      }
      const error = await start(
        needAction.action,
        "needs-" + needAction.action + "-" + crypto.randomUUID(),
      );
      setActionMessage(error ?? needAction.label + " started.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("osogbo-open-phone-app", { detail: { app: needAction.app } }),
    );
  };

  const toggleLabel = expanded
    ? "Collapse needs panel"
    : `Expand needs panel${criticalCount ? `, ${criticalCount} critical ${criticalCount === 1 ? "need" : "needs"}` : ""}`;

  return (
    <aside
      className={`game-needs-rail${expanded ? "" : " is-collapsed"}${compact ? " is-map-compact" : ""}`}
      aria-label={`${player.name}'s needs dashboard${criticalCount ? `, ${criticalCount} critical` : ""}`}
      data-critical-count={criticalCount}
    >
      <div className="game-needs-panel" aria-hidden={!expanded}>
        {criticalCount > 0 && (
          <span className="game-needs-summary" role="status" aria-live="polite">
            {criticalCount} critical
          </span>
        )}
        {expanded && (
          <button
            type="button"
            className="game-needs-toggle"
            aria-expanded
            aria-label="Collapse needs panel"
            title="Hide needs"
            onClick={() => setExpanded(false)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
        <div className="game-needs-list">
          {NEED_NAMES.map((name) => {
            const Icon = NEED_ICONS[name];
            const value = Math.round(simulation.needs[name]);
            const status = statusForNeed(name, value);
            return (
              <button
                type="button"
                className={`game-needs-item is-${status}${detailNeed === name ? " is-active" : ""}`}
                key={name}
                aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}`}
                aria-pressed={detailNeed === name}
                title={`${NEED_RULES[name].label}: ${value}% · Tap for details`}
                tabIndex={expanded ? 0 : -1}
                onClick={() => {
                  setActionMessage(null);
                  setDetailNeed((current) => (current === name ? null : name));
                }}
              >
                <span
                  className="game-needs-icon-ring"
                  style={{
                    background: `conic-gradient(var(--need-tone) ${value}%, #e8ece8 0)`,
                  }}
                >
                  <span className="game-needs-icon-core">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                </span>
                <span className="game-needs-value">{value}%</span>
              </button>
            );
          })}
        </div>
        {detailNeed && detailValue !== null && expanded && (
          <div
            className="game-needs-detail"
            role="status"
            aria-live="polite"
            aria-label={`${NEED_RULES[detailNeed].label} need status`}
          >
            <strong>{NEED_RULES[detailNeed].label}</strong>
            <span>
              {detailValue}% · {statusForNeed(detailNeed, detailValue)}
            </span>
            <button
              type="button"
              className="game-needs-action"
              onClick={() => void handleNeedAction()}
              disabled={
                !!needAction &&
                "action" in needAction &&
                (busy || !ready || !!simulation.currentAction)
              }
            >
              {needAction?.label ?? "Choose an action"}
            </button>
            {actionMessage && (
              <span className="game-needs-action-message" role="status">
                {actionMessage}
              </span>
            )}
          </div>
        )}
      </div>
      {!expanded && (
        <button
          type="button"
          className="game-needs-tab"
          aria-expanded={false}
          aria-label={toggleLabel}
          title="Show needs"
          onClick={() => setExpanded(true)}
        >
          <Zap size={16} aria-hidden="true" />
          {criticalCount > 0 && <span className="game-needs-tab-dot" aria-hidden="true" />}
          <Plus size={11} className="game-needs-tab-plus" aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}
