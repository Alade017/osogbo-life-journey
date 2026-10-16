import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/threads/$id/star")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { handleThreadRequest } = await import("@/lib/thread-api.server");
        return handleThreadRequest(request, params.id, "star");
      },
      DELETE: async ({ request, params }) => {
        const { handleThreadRequest } = await import("@/lib/thread-api.server");
        return handleThreadRequest(request, params.id, "unstar");
      },
    },
  },
});
