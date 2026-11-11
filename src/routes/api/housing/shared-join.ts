import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/shared-join")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSharedHomeJoin } = await import("@/lib/shared-home-api.server");
        return handleSharedHomeJoin(request);
      },
    },
  },
});
