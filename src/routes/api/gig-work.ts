import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gig-work")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/gig-work-api.server")).handleGigBoardRequest(request),
      POST: async ({ request }) =>
        (await import("@/lib/gig-work-api.server")).handleGigActionRequest(request),
    },
  },
});
