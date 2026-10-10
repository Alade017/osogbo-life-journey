import { createFileRoute } from "@tanstack/react-router";
import { NeighborhoodGame } from "@/components/game/NeighborhoodGame";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("City Map", "Explore the living fictional city of OSOGBO LIFE."),
  component: () => (
    <CityMapDashboard>
      <NeighborhoodGame />
    </CityMapDashboard>
  ),
});
