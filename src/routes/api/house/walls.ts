import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/house/walls")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleHouseWallsRequest } = await import("@/lib/house-walls-api.server");
        return handleHouseWallsRequest("GET", request);
      },
      POST: async ({ request }) => {
        const { handleHouseWallsRequest } = await import("@/lib/house-walls-api.server");
        return handleHouseWallsRequest("POST", request);
      },
    },
  },
});
