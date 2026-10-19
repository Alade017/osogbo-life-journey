import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/map-properties")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getHousingMapProperties } = await import("@/lib/housing-map-api.server");
        return getHousingMapProperties(request);
      },
    },
  },
});
