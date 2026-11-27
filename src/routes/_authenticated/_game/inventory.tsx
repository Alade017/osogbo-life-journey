import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_game/inventory")({
  beforeLoad: () => {
    throw redirect({ to: "/profile" });
  },
});
