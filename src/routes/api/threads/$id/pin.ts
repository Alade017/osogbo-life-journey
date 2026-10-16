import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/threads/$id/pin")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { handleThreadRequest } = await import("@/lib/thread-api.server");
        return handleThreadRequest(request, params.id, "pin");
      },
      DELETE: async ({ request, params }) => {
        const { handleThreadRequest } = await import("@/lib/thread-api.server");
        return handleThreadRequest(request, params.id, "unpin");
      },
    },
  },
});
