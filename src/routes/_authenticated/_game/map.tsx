import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";
import { pageMeta } from "@/lib/seo";

const NeighborhoodGame = lazy(() =>
  import("@/components/game/NeighborhoodGame").then((module) => ({
    default: module.NeighborhoodGame,
  })),
);

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("City Map", "Explore the living fictional city of OSOGBO LIFE."),
  component: () => (
    <CityMapDashboard>
      <Suspense
        fallback={
          <div className="city-map-loading" role="status">
            Loading 3D neighborhood…
          </div>
        }
      >
        <NeighborhoodGame />
      </Suspense>
    </CityMapDashboard>
  ),
});
