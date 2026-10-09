import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HomeInterior } from "@/components/game/HomeInterior";
import { q } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { useLiveClock } from "@/hooks/use-live-clock";
import { LifeSimulationPanel } from "@/components/game/LifeSimulationPanel";

export const Route = createFileRoute("/_authenticated/_game/home")({
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

function CityHome() {
  const now = useLiveClock();
  const { data: character } = useQuery(q.character());

  if (!character) return null;

  return (
    <div className="game-home home-only-page">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">
            {now ? dashboardGreeting(now.getHours()) : "Welcome home"}, {character.name}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Your home</h1>
        </div>
      </div>
      <LifeSimulationPanel />
      <HomeInterior />
    </div>
  );
}
