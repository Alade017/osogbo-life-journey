import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/current-home")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getHousingCurrentHome } = await import("@/lib/housing-home-api.server");
        return getHousingCurrentHome(request);
      },
    },
  },
});
