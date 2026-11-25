import { Activity } from "lucide-react";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { NEED_NAMES, NEED_RULES, statusForNeed, type NeedName } from "@/lib/life-simulation";
import "./vitalstat-nesta-app.css";

/** What to do about each need, shown only when that need is running low. */
const ADVICE: Record<NeedName, string> = {
  hunger: "Eat a meal. Food from the market or a cook at home both work.",
  energy: "Go home and rest. Sleep restores energy fastest.",
  hygiene: "Go home and shower before you go out again.",
  bladder: "Find a toilet: at home, or at a public facility.",
  fun: "Find something fun: a party, a game or an outing.",
  social: "Message a friend, or visit someone in the neighbourhood.",
};

const RANK = { critical: 0, warning: 1, healthy: 2 } as const;

/** Player vitals with the reason each one is low and the next thing to do. Read-only. */
export function VitalStatApp() {
  const { simulation, ready } = useGameTime();
  const needs = NEED_NAMES.map((name) => {
    const value = Math.max(0, Math.min(100, Math.round(simulation.needs[name])));
    return { name, value, status: statusForNeed(name, value) };
  }).sort((a, b) => RANK[a.status] - RANK[b.status] || a.value - b.value);
  const lowCount = needs.filter((need) => need.status !== "healthy").length;

  return (
    <section className="vitalstat-app" aria-label="VitalStat">
      <header className="vitalstat-hero">
        <span className="vitalstat-mark" aria-hidden="true">
          <Activity size={20} />
        </span>
        <div>
          <h2>VitalStat</h2>
          <p>
            {!ready
              ? "Checking your vitals…"
              : lowCount === 0
                ? "Everything is in a healthy range."
                : `${lowCount} ${lowCount === 1 ? "need is" : "needs are"} running low.`}
          </p>
        </div>
      </header>
      <ul className="vitalstat-list">
        {needs.map((need) => (
          <li key={need.name} className={`vitalstat-row vitalstat-${need.status}`}>
            <div className="vitalstat-row-head">
              <span>{NEED_RULES[need.name].label}</span>
              <strong>{need.value}%</strong>
            </div>
            <div
              className="vitalstat-bar"
              role="meter"
              aria-label={NEED_RULES[need.name].label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={need.value}
            >
              <span style={{ width: `${need.value}%` }} />
            </div>
            {need.status !== "healthy" ? (
              <p className="vitalstat-advice">{ADVICE[need.name]}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
