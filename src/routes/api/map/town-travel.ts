import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/map/town-travel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTownTravelRequest } = await import("@/lib/town-travel-api.server");
        return handleTownTravelRequest(request);
      },
    },
  },
});
