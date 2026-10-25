import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/map/landmarks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleMapLandmarksRequest } = await import("@/lib/map-api.server");
        return handleMapLandmarksRequest(request);
      },
    },
  },
});
