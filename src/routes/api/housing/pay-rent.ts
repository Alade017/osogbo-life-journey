import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/pay-rent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHousingRequest } = await import("@/lib/housing-api.server");
        return handleHousingRequest("pay-rent", request);
      },
    },
  },
});
