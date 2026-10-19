import { createFileRoute } from "@tanstack/react-router";
import { FriendHomeVisit } from "@/components/game/housing/FriendHomeVisit";
import { pageMeta } from "@/lib/seo";
import { HousePage } from "./house";

export const Route = createFileRoute("/_authenticated/_game/home")({
  validateSearch: (search: Record<string, unknown>) => ({
    visit: typeof search["visit"] === "string" ? search["visit"] : undefined,
  }),
  head: () => pageMeta("Osogbo · Home", "Step into your day in Osogbo."),
  component: CityHome,
});

function CityHome() {
  const { visit } = Route.useSearch();
  return visit ? <FriendHomeVisit characterId={visit} /> : <HousePage homeRoute />;
}
