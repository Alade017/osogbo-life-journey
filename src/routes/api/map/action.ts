import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/map/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMapPlaceActionRequest } = await import("@/lib/map-place-action.server");
        return handleMapPlaceActionRequest(request);
      },
    },
  },
});
