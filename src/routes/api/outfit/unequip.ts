import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/outfit/unequip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHouseRequest } = await import("@/lib/house-api.server");
        return handleHouseRequest("unequip", request);
      },
    },
  },
});
