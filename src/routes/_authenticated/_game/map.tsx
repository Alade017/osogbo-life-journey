import { createFileRoute } from "@tanstack/react-router";
import { NeighborhoodGame } from "@/components/game/NeighborhoodGame";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/map")({
  head: () => pageMeta("City Map", "Explore the living fictional city of OSOGBO LIFE."),
  component: () => (
    <div className="-mx-2.75 -mt-3 px-2.75 pb-3 md:-mx-4 md:-mt-6 md:px-4">
      <NeighborhoodGame />
    </div>
  ),
});
