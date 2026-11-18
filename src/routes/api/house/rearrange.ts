import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/house/rearrange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHouseRearrange } = await import("@/lib/house-rearrange.server");
        return handleHouseRearrange(request);
      },
    },
  },
});
