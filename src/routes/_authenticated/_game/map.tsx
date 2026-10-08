import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { OsogboMap } from "@/components/game/OsogboMap";
import { LocationCard } from "@/components/game/LocationCard";
import { Chip, PageHeader } from "@/components/game/ui";
import { normalizeCityLocation } from "@/lib/location-service";

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("City Map", "Explore Osogbo on the interactive city map."),
  component: MapPage,
});

function MapPage() {
  const { data: locations } = useQuery(q.locations());
  const { data: jobs } = useQuery(q.jobs());
  const { data: visits } = useQuery(q.visits());
  const visited = new Set(visits?.map((v) => v.location_id));
  return (
    <div className="-mx-2.75 px-2.75 py-5 md:-mx-4 md:px-4 md:py-8">
      <PageHeader
        title="City Map"
        subtitle={`Osogbo, Osun State · ${visited.size}/${locations?.length ?? 9} districts discovered`}
      />
      <OsogboMap />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations?.map((l) => {
          const openJobs =
            jobs?.filter((job) => job.location_id === l.id && job.is_available).length ?? 0;
          return (
            <Link
              key={l.id}
              to="/location/$slug"
              params={{ slug: l.slug }}
              className="city-location-link"
            >
              <LocationCard
                location={normalizeCityLocation(l)}
                accessory={
                  <span className="flex flex-wrap justify-end gap-1">
                    {openJobs > 0 && <Chip tone="primary">{openJobs} hiring</Chip>}
                    {visited.has(l.id) ? <Chip tone="leaf">Visited</Chip> : <Chip>New</Chip>}
                  </span>
                }
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
