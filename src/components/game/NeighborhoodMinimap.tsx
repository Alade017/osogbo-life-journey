import type { MinimapTelemetry } from "@/game/neighborhood-minimap";

/** A small, read-only overview of the neighbourhood. Draws only what telemetry says. */
export function NeighborhoodMinimap({
  telemetry,
  className = "",
}: {
  telemetry: MinimapTelemetry;
  className?: string;
}) {
  const dot = (x: number, y: number) => ({ left: `${x * 100}%`, top: `${y * 100}%` });
  return (
    <div
      role="img"
      aria-label={
        telemetry.target ? "Neighbourhood minimap, destination marked" : "Neighbourhood minimap"
      }
      className={`relative h-24 w-24 overflow-hidden rounded-xl border border-black/15 bg-white/85 shadow-md backdrop-blur-sm ${className}`}
    >
      {telemetry.others.map((point, index) => (
        <span
          key={index}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500"
          style={dot(point.x, point.y)}
        />
      ))}
      {telemetry.target && (
        <span
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-500"
          style={dot(telemetry.target.x, telemetry.target.y)}
        />
      )}
      {telemetry.self && (
        <span
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600 ring-2 ring-white"
          style={dot(telemetry.self.x, telemetry.self.y)}
        />
      )}
    </div>
  );
}
