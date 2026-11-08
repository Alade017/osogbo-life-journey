import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/neighborhood/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleNeighborhoodPlaceActionRequest } = await import(
          "@/lib/neighborhood-place-action.server"
        );
        return handleNeighborhoodPlaceActionRequest(request);
      },
    },
  },
});
