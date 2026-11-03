import { LoaderCircle } from "lucide-react";

export function WorldLoadingIndicator({
  title,
  detail,
  progress,
}: {
  title: string;
  detail?: string;
  progress?: number;
}) {
  const isDeterminate = typeof progress === "number";
  const value = isDeterminate ? Math.max(0, Math.min(100, progress)) : undefined;
  return (
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
}
