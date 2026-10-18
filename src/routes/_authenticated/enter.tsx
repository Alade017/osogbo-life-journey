import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve saved links while keeping the player dashboard at one canonical route.
export const Route = createFileRoute("/_authenticated/enter")({
  beforeLoad: () => {
    throw redirect({ to: "/home", search: { visit: undefined }, replace: true });
  },
});
