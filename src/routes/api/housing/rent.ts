import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/rent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHousingRequest } = await import("@/lib/housing-api.server");
        return handleHousingRequest("rent", request);
      },
    },
  },
});
