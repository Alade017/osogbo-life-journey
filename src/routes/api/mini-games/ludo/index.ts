import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mini-games/ludo/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLudoAction } = await import("@/lib/mini-games/ludo-table.server");
        return handleLudoAction(request);
      },
    },
  },
});
