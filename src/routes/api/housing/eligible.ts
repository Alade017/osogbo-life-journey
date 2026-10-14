import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/eligible")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleHousingRequest } = await import("@/lib/housing-api.server");
        return handleHousingRequest("eligible", request);
      },
    },
  },
});
