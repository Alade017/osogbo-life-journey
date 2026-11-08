import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isSlowNetwork } from "@/lib/network-hint";

/** Wait before the slow-network message appears: sooner on slow connections. */
const SLOW_NETWORK_AFTER_MS = 1500;
const NORMAL_NETWORK_AFTER_MS = 4000;
/** While still waiting, the spinner slows down by this much every step. */
const SLOW_STEP_MS = 2000;
const SPINNER_BASE_SECONDS = 1;
const SPINNER_MAX_SECONDS = 3.5;

/**
 * Spinner shown while a phone app loads. It appears immediately. If the wait
 * runs long, or the connection is slow, it explains that, offers Retry or
 * Back, and slows the spinner down so a slow load does not look frozen.
 */
export function PhoneAppLoader({
  title,
  compact = false,
  onHome,
}: {
  title: string;
  compact?: boolean;
  onHome?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [slowNetwork] = useState(isSlowNetwork);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 500);
    return () => window.clearInterval(timer);
  }, []);

  const threshold = slowNetwork ? SLOW_NETWORK_AFTER_MS : NORMAL_NETWORK_AFTER_MS;
  const isSlow = elapsed >= threshold;
  const steps = isSlow ? Math.floor((elapsed - threshold) / SLOW_STEP_MS) + 1 : 0;
  const spinSeconds = Math.min(SPINNER_BASE_SECONDS + steps * 0.5, SPINNER_MAX_SECONDS);

  return (
    <div
      className={compact ? "phone-app-loader is-compact" : "phone-app-loader"}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="phone-app-loader-mark"
        aria-hidden="true"
        style={{ animationDuration: `${spinSeconds}s` }}
      />
      <strong>{title}</strong>
      {isSlow && (
        <>
          <p>
            {slowNetwork
              ? "Your connection looks slow. Still loading…"
              : "This is taking longer than usual. Still loading…"}
          </p>
          <div className="phone-app-loader-actions">
            <button
              type="button"
              className="phone-btn-primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            {onHome && (
              <button type="button" onClick={onHome}>
                Back to apps
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
