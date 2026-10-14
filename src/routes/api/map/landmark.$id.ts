import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/map/landmark/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleMapLandmarkRequest } = await import("@/lib/map-api.server");
        return handleMapLandmarkRequest(request, params.id);
      },
    },
  },
});
