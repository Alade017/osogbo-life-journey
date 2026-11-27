import { useOutsideTransition } from "@/lib/outside-transition";
import "@/components/game/outside-transition.css";

/** Keep entry progress available to screen readers while the doorway stays visible. */
export function OutsideTransition() {
  const transition = useOutsideTransition();
  if (!transition.kind) return null;
  if (transition.kind === "entering")
    return (
      <span className="sr-only" role="status">
        {transition.label}
      </span>
    );
  const percent = Math.round((transition.done / transition.total) * 100);
  return (
    <div
      className="outside-transition"
      data-kind={transition.kind}
      role="status"
      aria-live="polite"
    >
      <div className="outside-transition-card">
        <p className="outside-transition-kicker">Going outside</p>
        <strong className="outside-transition-label">{transition.label}</strong>
        <div
          className="outside-transition-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Loading progress"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
