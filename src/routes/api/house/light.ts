import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/house/light")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleHouseLightRequest } = await import("@/lib/house-light-api.server");
        return handleHouseLightRequest("GET", request);
      },
      POST: async ({ request }) => {
        const { handleHouseLightRequest } = await import("@/lib/house-light-api.server");
        return handleHouseLightRequest("POST", request);
      },
    },
  },
});
