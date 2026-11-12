import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mini-games/whot/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleWhotAction } = await import("@/lib/mini-games/whot-table.server");
        return handleWhotAction(request);
      },
    },
  },
});
