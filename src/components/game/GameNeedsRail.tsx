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

export function GameNeedsRail({ player }: { player: PlayerState }) {
  const { simulation, start, busy, ready } = useGameTime();
  const [detailNeed, setDetailNeed] = useState<(typeof NEED_NAMES)[number] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const criticalCount = NEED_NAMES.filter(
    (name) => statusForNeed(name, Math.round(simulation.needs[name])) === "critical",
  ).length;
  // Preview mode surfaces the two needs requiring the most attention.
  const previewNeeds = NEED_NAMES.map((name) => ({
    name,
    value: Math.round(simulation.needs[name]),
    status: statusForNeed(name, Math.round(simulation.needs[name])),
  }))
    .filter((need) => need.status !== "healthy")
    .sort((a, b) => {
      const priority = { critical: 0, warning: 1, healthy: 2 };
      return priority[a.status] - priority[b.status] || a.value - b.value;
    })
    .slice(0, 2);
  const visibleNeeds = expanded ? NEED_NAMES : [];
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
    if ("action" in needAction && needAction.action === "eat") {
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

  return (
    <aside
      className={`game-needs-rail${expanded ? "" : " is-collapsed"}`}
      aria-label={`${player.name}'s needs dashboard${criticalCount ? `, ${criticalCount} critical` : ""}`}
      data-critical-count={criticalCount}
    >
      {criticalCount > 0 && (
        <span className="game-needs-summary" role="status" aria-live="polite">
          {criticalCount} critical
        </span>
      )}
      <button
        type="button"
        className="game-needs-toggle"
        aria-expanded={expanded}
        aria-label={
          expanded
            ? "Collapse needs panel"
            : `Expand needs panel${criticalCount ? `, ${criticalCount} critical ${criticalCount === 1 ? "need" : "needs"}` : ""}`
        }
        title={expanded ? "Collapse needs panel" : "Expand needs panel"}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? (
          <X size={12} aria-hidden="true" />
        ) : (
          <>
            <Zap className="game-needs-collapsed-icon" size={23} aria-hidden="true" />
            <span className="game-needs-collapsed-plus" aria-hidden="true">
              <Plus size={13} />
            </span>
          </>
        )}
      </button>
      {!expanded && (
        <div className="game-needs-preview" aria-label="Needs requiring attention">
          {previewNeeds.map(({ name, value, status }) => {
            const Icon = NEED_ICONS[name];
            return (
              <button
                type="button"
                className={`game-needs-preview-pill is-${status}`}
                key={name}
                aria-label={`${NEED_RULES[name].label}: ${value} percent, ${status}. Tap for details`}
                onClick={() => {
                  setActionMessage(null);
                  setDetailNeed(name);
                }}
              >
                <Icon size={13} aria-hidden="true" />
                <span>{NEED_RULES[name].label}</span>
                <strong>{value}%</strong>
              </button>
            );
          })}
          {previewNeeds.length === 0 && (
            <span className="game-needs-preview-empty">All needs are good</span>
          )}
        </div>
      )}
      <div className="game-needs-list">
        {visibleNeeds.map((name) => {
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
      {detailNeed && detailValue !== null && (
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
    </aside>
  );
}
