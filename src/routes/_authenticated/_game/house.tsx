import { createFileRoute } from "@tanstack/react-router";
import { HouseInterior } from "@/components/game/HouseInterior";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/house")({
  head: () => pageMeta("House Interior", "Explore your home, move between rooms, and improve your space."),
  component: HousePage,
});

function HousePage() {
  return <HouseInterior />;
}
