import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Compass, Target } from "lucide-react";
import { CityView } from "@/components/game/CityView";
import { GameQuickActions } from "@/components/game/GameQuickActions";
import { NeedsPanel } from "@/components/game/NeedsPanel";
import { q, formatNaira } from "@/lib/game";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/home")({
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

function CityHome() {
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: locations } = useQuery(q.locations());
  const { data: playerJobs } = useQuery(q.myJobs());
  const { data: jobs } = useQuery(q.jobs());
  const { data: missions } = useQuery(q.missions());

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

  return (
    <div className="game-home">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">E kaabo, {character.name}</p>
          <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
            A new day in Osogbo
          </h1>
        </div>
        <Link to="/jobs" className="arrival-job">
          <Briefcase className="h-4 w-4" />
          <span>{currentJob?.name ?? "No job yet"}</span>
        </Link>
      </div>

      <div className="game-home-grid">
        <div className="game-world-column">
          <CityView character={character} location={location} locations={locations ?? []} />
          <section className="day-objective" aria-label="Current objective">
            <span className="objective-icon">
              <Target className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Your next move
              </p>
              <h2 className="mt-0.5 truncate text-sm font-bold text-white">
                {lowEnergy ? "Take a breather while energy returns" : missionText}
              </h2>
              <p className="mt-0.5 truncate text-xs text-white/50">
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
        </div>

        <aside className="game-side-rail" aria-label="Player controls">
          <NeedsPanel character={character} />
          <GameQuickActions />
          <Link to="/map" className="discover-link">
            <Compass className="h-4 w-4" />
            <span>See the whole city</span>
            <ArrowRight className="ml-auto h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
