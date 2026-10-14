import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/house/state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleHouseRequest } = await import("@/lib/house-api.server");
        return handleHouseRequest("state", request);
      },
    },
  },
});
