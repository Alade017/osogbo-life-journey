import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/map/travel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMapTravelRequest } = await import("@/lib/map-api.server");
        return handleMapTravelRequest(request);
      },
    },
  },
});
