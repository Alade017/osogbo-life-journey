import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Compass, Target } from "lucide-react";
import { OsogboMap } from "@/components/game/OsogboMap";
import { CityBillboards } from "@/components/game/CityBillboards";
import { GameQuickActions } from "@/components/game/GameQuickActions";
import { NeedsPanel } from "@/components/game/NeedsPanel";
import { VirtualHouse } from "@/components/game/VirtualHouse";
import { q, formatNaira } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { useGameTime } from "@/components/game/GameTimeProvider";

export const Route = createFileRoute("/_authenticated/_game/home")({
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

function CityHome() {
  const { gameTime } = useGameTime();
  const { data: character } = useQuery(q.character());
  const { data: locations } = useQuery(q.locations());
  const { data: playerJobs } = useQuery(q.myJobs());
  const { data: jobs } = useQuery(q.jobs());
  const { data: missions } = useQuery(q.missions());
  const { data: billboards } = useQuery(q.billboards());

  if (!character) return null;

  const location = locations?.find((item) => item.id === character.current_location_id);
  const currentJob = jobs?.find(
    (job) => job.id === playerJobs?.find((playerJob) => playerJob.is_current)?.job_id,
  );
  const nextMission = missions
    ?.filter((mission) => mission.status === "in_progress")
    .sort((a, b) => (a.mission?.sort_order ?? 0) - (b.mission?.sort_order ?? 0))[0];
  const lowEnergy = character.energy < 25;
  const missionText = nextMission?.mission?.title ?? "Explore a new part of town";
  const nextPath = lowEnergy ? "/profile" : currentJob ? "/map" : "/jobs";
  const nextLabel = lowEnergy
    ? "Check your stats"
    : currentJob
      ? "Explore the city"
      : "Find your first job";
  const nearby = [...(locations ?? [])]
    .sort((a, b) => {
      if (a.id === character.current_location_id) return -1;
      if (b.id === character.current_location_id) return 1;
      return a.sort_order - b.sort_order;
    })
    .slice(0, 3);
  const billboardLocationId = billboards?.[0]?.location_id;

  return (
    <div className="game-home">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">
            {dashboardGreeting(gameTime.hour)}, {character.name}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Your Osogbo story
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {location?.name ?? "Osogbo"} · {currentJob?.name ?? "Make today yours"}
          </p>
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
    </div>
  );
}
