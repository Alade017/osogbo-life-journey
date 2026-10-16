import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/username/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleUsernameAuth } = await import("@/lib/username-auth.server");
        return handleUsernameAuth(request, "login");
      },
    },
  },
});
