import { createFileRoute } from "@tanstack/react-router";
import { PlayableNeighborhood } from "@/components/game/PlayableNeighborhood";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/neighborhood")({
  head: () =>
    pageMeta("Olaiya neighbourhood", "Walk the streets and compounds of the Olaiya neighbourhood."),
  component: PlayableNeighborhood,
});
