import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/drawer/state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleDrawerRequest } = await import("@/lib/drawer-api.server");
        return handleDrawerRequest("state", request);
      },
    },
  },
});
