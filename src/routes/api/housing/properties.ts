import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/properties")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleHousingRequest } = await import("@/lib/housing-api.server");
        return handleHousingRequest("properties", request);
      },
    },
  },
});
