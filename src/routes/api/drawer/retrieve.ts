import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/drawer/retrieve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleDrawerRequest } = await import("@/lib/drawer-api.server");
        return handleDrawerRequest("retrieve", request);
      },
    },
  },
});
