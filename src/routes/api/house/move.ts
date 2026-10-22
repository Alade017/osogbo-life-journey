import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/house/move")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHouseRequest } = await import("@/lib/house-api.server");
        return handleHouseRequest("move", request);
      },
    },
  },
});
