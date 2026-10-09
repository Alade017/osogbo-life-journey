import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Compass, MapPin } from "lucide-react";
import { Chip } from "@/components/game/ui";
import { LocationCard } from "@/components/game/LocationCard";
import { OsogboMap } from "@/components/game/OsogboMap";
import { q } from "@/lib/game";
import { normalizeCityLocation } from "@/lib/location-service";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("City Map", "Explore Osogbo on the interactive city map."),
  component: MapPage,
});

function MapPage() {
  const { data: locations } = useQuery(q.locations());
  const { data: jobs } = useQuery(q.jobs());
  const { data: visits } = useQuery(q.visits());
  const visited = new Set(visits?.map((visit) => visit.location_id));
  const openJobs = jobs?.filter((job) => job.is_available).length ?? 0;

  return (
    <div className="city-explorer-page -mx-2.75 px-2.75 py-5 md:-mx-4 md:px-4 md:py-8">
      <header className="city-explorer-header">
        <div className="city-explorer-intro">
          <span className="city-explorer-eyebrow">
            <Compass size={14} /> YOUR WORLD, YOUR PACE
          </span>
          <h1>Explore Osogbo</h1>
          <p>
            Find your next stop, discover new neighborhoods, and see what’s happening around you.
          </p>
        </div>

        <div className="city-explorer-stats" aria-label="City exploration stats">
          <div className="city-explorer-stat">
            <span className="city-explorer-stat-icon">
              <MapPin size={17} />
            </span>
            <span>
              <strong>{locations?.length ?? 0}</strong>
              <small>places to explore</small>
            </span>
          </div>
          <div className="city-explorer-stat">
            <span className="city-explorer-stat-icon is-amber">
              <BriefcaseBusiness size={17} />
            </span>
            <span>
              <strong>{openJobs}</strong>
              <small>open opportunities</small>
            </span>
          </div>
          <div className="city-explorer-stat">
            <span className="city-explorer-stat-icon is-green">
              <Compass size={17} />
            </span>
            <span>
              <strong>
                {visited.size}
                <small className="city-explorer-stat-total"> / {locations?.length ?? 0}</small>
              </strong>
              <small>places discovered</small>
            </span>
          </div>
        </div>
      </header>

      <section className="city-explorer-map-section" aria-labelledby="city-map-title">
        <div className="city-explorer-section-heading">
          <div>
            <span className="city-explorer-live">
              <i /> LIVE CITY MAP
            </span>
            <h2 id="city-map-title">The city is yours to explore</h2>
            <p>Choose a marker or browse places below to see what’s nearby.</p>
          </div>
          <span className="city-explorer-region">
            OSOGBO <span>·</span> OSUN STATE
          </span>
        </div>
        <OsogboMap />
      </section>

      <section className="city-explorer-places" aria-labelledby="city-places-title">
        <div className="city-explorer-section-heading city-explorer-places-heading">
          <div>
            <span className="city-explorer-live">YOUR CITY GUIDE</span>
            <h2 id="city-places-title">Places around Osogbo</h2>
            <p>Explore districts, check what’s open, and plan your next visit.</p>
          </div>
          <span className="city-explorer-place-count">{locations?.length ?? 0} places</span>
        </div>
        <div className="city-explorer-place-grid">
          {locations?.map((location) => {
            const locationJobs =
              jobs?.filter((job) => job.location_id === location.id && job.is_available).length ??
              0;
            return (
              <Link
                key={location.id}
                to="/location/$slug"
                params={{ slug: location.slug }}
                className="city-location-link"
              >
                <LocationCard
                  location={normalizeCityLocation(location)}
                  accessory={
                    <span className="flex flex-wrap justify-end gap-1">
                      {locationJobs > 0 && <Chip tone="primary">{locationJobs} hiring</Chip>}
                      {visited.has(location.id) ? (
                        <Chip tone="leaf">Visited</Chip>
                      ) : (
                        <Chip>New</Chip>
                      )}
                    </span>
                  }
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
