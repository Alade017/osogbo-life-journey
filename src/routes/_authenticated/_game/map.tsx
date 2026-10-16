import { createFileRoute } from "@tanstack/react-router";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("Osun map", "Explore towns and fictional public places across OSUN LIFE."),
  component: CityMapDashboard,
});
