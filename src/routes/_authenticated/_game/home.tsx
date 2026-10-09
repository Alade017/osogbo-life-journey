import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Compass, Target } from "lucide-react";
import { CityBillboards } from "@/components/game/CityBillboards";
import { GameQuickActions } from "@/components/game/GameQuickActions";
import { HomeInterior } from "@/components/game/HomeInterior";
import { LifeSimulationPanel } from "@/components/game/LifeSimulationPanel";
import { NeedsPanel } from "@/components/game/NeedsPanel";
import { OsogboMap } from "@/components/game/OsogboMap";
import { VirtualHouse } from "@/components/game/VirtualHouse";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { q, formatNaira } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { useLiveClock } from "@/hooks/use-live-clock";

export const Route = createFileRoute("/_authenticated/_game/home")({
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

function CityHome() {
  const now = useLiveClock();
  const { data: character } = useQuery(q.character());
  const { data: jobs } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: locations } = useQuery(q.locations());

  if (!character) return null;

  const currentJobAssignment = myJobs?.find((job) => job.is_current);
  const currentJob = jobs?.find((job) => job.id === currentJobAssignment?.job_id);
  const nearby = (locations ?? []).slice(0, 4);
  const currentLocation = locations?.find(
    (location) => location.id === character.current_location_id,
  );
  const billboardLocationId = currentLocation?.id;
  const lowEnergy = character.energy < 20;
  const missionText = currentJob
    ? `Head to ${currentLocation?.name ?? "your district"} and complete a shift`
    : "Explore the city and find a job that suits you";
  const nextPath = currentJob ? "/jobs" : "/map";
  const nextLabel = currentJob ? "View job" : "Explore";

  return (
    <div className="game-home home-only-page">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">
            {now ? dashboardGreeting(now.getHours()) : "Welcome home"}, {character.name}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Your home</h1>
        </div>
        {currentJob && (
          <Link to="/jobs" className="arrival-job">
            <Briefcase className="h-4 w-4" />
            <span>{formatNaira(currentJob.salary)} per shift</span>
          </Link>
        )}
      </div>

      <div className="mt-5">
        <VirtualHouse characterName={character.name} />
      </div>

      <div className="game-home-grid mt-6">
        <div className="game-world-column">
          <section className="home-city-map" aria-label="Explore Osogbo">
            <div className="home-map-heading">
              <div>
                <p className="city-eyebrow">
                  <span className="city-live-dot" /> THE CITY IS YOURS
                </p>
                <h2 className="font-display text-lg font-bold text-ink">Explore Osogbo</h2>
              </div>
              <Link to="/map" className="city-map-link">
                Full map <Compass className="h-4 w-4" />
              </Link>
            </div>
            <OsogboMap />
          </section>

          <section className="home-districts" aria-label="Nearby districts">
            <div className="section-heading-row">
              <h2>Places around you</h2>
              <Link to="/map">
                All districts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="home-district-list">
              {nearby.map((item) => (
                <Link key={item.id} to="/location/$slug" params={{ slug: item.slug }}>
                  <span className="home-district-icon">
                    <Compass className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <strong>{item.name}</strong>
                    <small>
                      {item.id === character.current_location_id ? "You are here" : item.tagline}
                    </small>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              ))}
            </div>
          </section>

          {billboardLocationId && <CityBillboards locationId={billboardLocationId} />}
        </div>

        <aside className="game-side-rail" aria-label="Player status and actions">
          <NeedsPanel character={character} />
          <GameQuickActions />
          <section className="day-objective" aria-label="Current objective">
            <span className="objective-icon">
              <Target className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Your next move
              </p>
              <h2 className="mt-1 text-sm font-bold text-ink">
                {lowEnergy ? "Take a breather while energy returns" : missionText}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentJob
                  ? `${currentJob.name} · ${formatNaira(currentJob.salary)} per shift`
                  : "Choose a first job and start earning"}
              </p>
            </div>
            <Link to={nextPath} className="objective-link" aria-label={nextLabel}>
              <span>{nextLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
      <LifeSimulationPanel />
      <HomeInterior />
    </div>
  );
}
