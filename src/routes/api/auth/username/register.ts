import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/username/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleUsernameAuth } = await import("@/lib/username-auth.server");
        return handleUsernameAuth(request, "register");
      },
    },
  },
});
