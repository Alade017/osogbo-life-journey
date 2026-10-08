import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MapPin } from "lucide-react";
import { q } from "@/lib/game";
import { cn } from "@/lib/utils";

export const TONE_BG: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  sun: "bg-sun text-sun-foreground",
  clay: "bg-clay text-clay-foreground",
  ink: "bg-ink text-ink-foreground",
  leaf: "bg-leaf text-foreground",
};

/** Interactive district map of the fictional Osogbo city. */
export function CityBoard({ compact = false }: { compact?: boolean }) {
  const { data: locations } = useQuery(q.locations());
  const { data: visits } = useQuery(q.visits());
  const { data: character } = useQuery(q.character());
  const visited = new Set(visits?.map((v) => v.location_id));

  return (
    <div
      className={cn(
        "game-panel relative overflow-hidden p-0",
        compact ? "aspect-16/10" : "aspect-4/5 sm:aspect-16/10",
      )}
    >
      {/* River & roads */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 12 C 20 18, 30 6, 45 14 S 70 30, 100 22"
          fill="none"
          stroke="var(--sky)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M50 0 L50 100 M0 50 L100 50 M20 85 L80 20"
          fill="none"
          stroke="var(--secondary)"
          strokeWidth="3.2"
        />
        <path
          d="M50 0 L50 100 M0 50 L100 50 M20 85 L80 20"
          fill="none"
          stroke="var(--edge)"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
      </svg>
      {locations?.map((l) => (
        <Link
          key={l.id}
          to="/location/$slug"
          params={{ slug: l.slug }}
          aria-current={character?.current_location_id === l.id ? "location" : undefined}
          title={
            character?.current_location_id === l.id ? `${l.name} · Your current district` : l.name
          }
          className={cn(
            "game-control absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 text-center leading-tight",
            compact ? "text-[10px] sm:text-xs" : "text-[11px] sm:text-sm sm:px-3 sm:py-1.5",
            TONE_BG[l.color] ?? TONE_BG["primary"],
            character?.current_location_id === l.id &&
              "ring-4 ring-white ring-offset-2 ring-offset-primary",
          )}
          style={{ left: `${l.map_x}%`, top: `${l.map_y}%` }}
        >
          {character?.current_location_id === l.id && <MapPin className="mr-0.5 inline h-3 w-3" />}
          {visited.has(l.id) && (
            <span
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-edge bg-card text-foreground"
              aria-label="Visited"
            >
              <Check className="h-3 w-3" />
            </span>
          )}
          {l.name}
        </Link>
      ))}
    </div>
  );
}
