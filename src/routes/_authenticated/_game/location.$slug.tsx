import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, MapPin } from "lucide-react";
import { q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { ComingSoon, EmptyState, LoadingBricks } from "@/components/game/ui";
import { TONE_BG } from "@/components/game/CityBoard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_game/location/$slug")({
  head: () => pageMeta("District", "Visit a district of Osogbo."),
  component: LocationPage,
});

function LocationPage() {
  const { slug } = Route.useParams();
  const { data: locations, isLoading } = useQuery(q.locations());
  const { data: visits } = useQuery(q.visits());
  const loc = locations?.find((l) => l.slug === slug);
  const visit = visits?.find((v) => v.location_id === loc?.id);
  const action = useGameAction(rpc.visitLocation, {
    onSuccess: (r) => toast.success(r.first_visit ? `Discovered ${loc?.name}! +10 XP` : `You spent time in ${loc?.name}.`),
  });

  if (isLoading) return <LoadingBricks />;
  if (!loc) return <EmptyState title="District not found" body="That place isn't on the map." />;

  return (
    <div className="space-y-5">
      <Link to="/map" className="inline-flex items-center gap-1 text-sm font-bold"><ArrowLeft className="h-4 w-4" /> Back to map</Link>
      <div className={cn("brick studs p-6 md:p-10")}>
        <span className={cn("inline-block rounded-lg border-2 border-edge px-3 py-1 font-display text-sm font-bold", TONE_BG[loc.color])}>{loc.district_type}</span>
        <h1 className="mt-3 text-4xl font-bold md:text-5xl">{loc.name}</h1>
        <p className="mt-1 text-lg font-semibold">{loc.tagline}</p>
      </div>
      <div className="brick p-5">
        <p>{loc.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="brick" onClick={() => action.mutate(loc.id)} disabled={action.isPending}>
            <MapPin /> {visit ? "Spend time here" : "Visit district"}
          </Button>
          {visit && <span className="text-sm text-muted-foreground">Visited {visit.visit_count}×</span>}
        </div>
      </div>
      <div className="brick p-5">
        <h2 className="text-xl font-bold">Places in {loc.name}</h2>
        <p className="text-sm text-muted-foreground">These activities are planned for future updates.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {loc.planned_features.map((f) => (
            <li key={f} className="flex items-center justify-between gap-2 rounded-lg border-2 border-dashed border-edge/40 p-3">
              <span className="font-semibold">{f}</span><ComingSoon />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
