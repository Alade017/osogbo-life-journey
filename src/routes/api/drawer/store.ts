import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/drawer/store")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleDrawerRequest } = await import("@/lib/drawer-api.server");
        return handleDrawerRequest("store", request);
      },
    },
  },
});
