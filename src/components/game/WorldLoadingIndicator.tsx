import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LoadingSpinner } from "./LoadingSpinner";
import "./world-loading.css";

export function WorldLoadingIndicator({
  title,
  detail,
  progress,
  presentation = "inline",
  action,
}: {
  title: string;
  detail?: string;
  progress?: number;
  presentation?: "inline" | "screen";
  action?: ReactNode;
}) {
  // Layout effect: the full-page screen mounts before the browser paints, so the
  // page underneath never shows for a frame.
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    if (presentation === "screen") setMounted(true);
  }, [presentation]);
  const isDeterminate = typeof progress === "number";
  const value = isDeterminate ? Math.max(0, Math.min(100, progress)) : undefined;
  const isScreen = presentation === "screen";
  const showBar = isScreen || isDeterminate;
  const indicator = (
    <div
      className={isScreen ? "world-loading-indicator is-screen" : "world-loading-indicator"}
      role="status"
      aria-live="polite"
    >
      {!isScreen && <LoadingSpinner className="world-loading-spinner" />}
      <strong>{title}</strong>
      {showBar && (
        <div
          className={`world-loading-bar${isDeterminate ? "" : " is-indeterminate"}`}
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          {...(value === undefined ? {} : { "aria-valuenow": value })}
        >
          <span style={value === undefined ? undefined : { width: `${value}%` }} />
        </div>
      )}
      {detail && <span className="world-loading-detail">{detail}</span>}
      {action}
    </div>
  );
  if (!isScreen) return indicator;
  return mounted && typeof document !== "undefined"
    ? createPortal(<div className="world-loading-overlay">{indicator}</div>, document.body)
    : null;
}
