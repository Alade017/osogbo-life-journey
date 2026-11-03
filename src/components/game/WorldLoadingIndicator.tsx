import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./world-loading.css";

export function WorldLoadingIndicator({
  title,
  detail,
  progress,
  presentation = "inline",
}: {
  title: string;
  detail?: string;
  progress?: number;
  presentation?: "inline" | "screen";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (presentation === "screen") setMounted(true);
  }, [presentation]);
  const isDeterminate = typeof progress === "number";
  const value = isDeterminate ? Math.max(0, Math.min(100, progress)) : undefined;
  const indicator = (
    <div className="world-loading-indicator" role="status" aria-live="polite">
      <LoaderCircle className="world-loading-icon" aria-hidden="true" />
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
      <div
        className={`travel-progress-track${isDeterminate ? "" : " is-indeterminate"}`}
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(value === undefined ? {} : { "aria-valuenow": value })}
      >
        <span style={value === undefined ? undefined : { width: `${value}%` }} />
      </div>
    </div>
  );
  return presentation === "screen"
    ? mounted
      ? createPortal(<div className="world-loading-overlay">{indicator}</div>, document.body)
      : null
    : indicator;
}
