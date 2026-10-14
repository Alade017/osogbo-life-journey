import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/choose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHousingRequest } = await import("@/lib/housing-api.server");
        return handleHousingRequest("choose", request);
      },
    },
  },
});
