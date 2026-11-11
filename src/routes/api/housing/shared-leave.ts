import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/shared-leave")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSharedHomeLeave } = await import("@/lib/shared-home-api.server");
        return handleSharedHomeLeave(request);
      },
    },
  },
});
