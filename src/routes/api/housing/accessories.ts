import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/housing/accessories")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/housing-rent-relief-api.server")).handleAccessoryBudgetRequest(
          request,
        ),
    },
  },
});
