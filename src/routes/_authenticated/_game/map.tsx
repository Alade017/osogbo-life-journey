import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { CityBoard, TONE_BG } from "@/components/game/CityBoard";
import { Chip, PageHeader } from "@/components/game/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("City Map", "Explore the nine districts of a miniature Osogbo-inspired city."),
  component: MapPage,
});

function MapPage() {
  const { data: locations } = useQuery(q.locations());
  const { data: visits } = useQuery(q.visits());
  const visited = new Set(visits?.map((v) => v.location_id));
  return (
    <div className="lego-world -mx-3 px-3 py-5 md:-mx-4 md:px-4 md:py-8">
      <PageHeader title="City Map" subtitle={`A fictional, game-inspired Osogbo · ${visited.size}/${locations?.length ?? 9} districts discovered`} />
      <CityBoard />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations?.map((l) => (
          <Link key={l.id} to="/location/$slug" params={{ slug: l.slug }} className="brick block p-4 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2">
              <span className={cn("h-8 w-8 shrink-0 rounded-md border-2 border-edge", TONE_BG[l.color])} />
              {visited.has(l.id) ? <Chip tone="leaf">Visited</Chip> : <Chip>New</Chip>}
            </div>
            <h3 className="mt-3 text-lg font-bold">{l.name}</h3>
            <p className="text-sm font-semibold text-muted-foreground">{l.tagline}</p>
            <p className="mt-2 line-clamp-2 text-sm">{l.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
