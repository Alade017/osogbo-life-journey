import { useOutsideTransition } from "@/lib/outside-transition";
import "@/components/game/outside-transition.css";

/** Full-screen veil for leaving or entering the home. Shows real progress only. */
export function OutsideTransition() {
  const transition = useOutsideTransition();
  if (!transition.kind) return null;
  const percent = Math.round((transition.done / transition.total) * 100);
  return (
    <div className="outside-transition" role="status" aria-live="polite">
      <div className="outside-transition-card">
        <p className="outside-transition-kicker">
          {transition.kind === "leaving" ? "Going outside" : "Coming home"}
        </p>
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
