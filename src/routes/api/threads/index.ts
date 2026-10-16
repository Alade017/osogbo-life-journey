import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/threads/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleThreadRequest } = await import("@/lib/thread-api.server");
        return handleThreadRequest(request);
      },
    },
  },
});
