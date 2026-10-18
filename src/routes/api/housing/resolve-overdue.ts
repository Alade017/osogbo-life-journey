import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/resolve-overdue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHousingRequest } = await import("@/lib/housing-api.server");
        return handleHousingRequest("resolve-overdue", request);
      },
    },
  },
});
