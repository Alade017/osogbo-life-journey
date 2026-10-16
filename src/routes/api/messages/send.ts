import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/messages/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMessageSendRequest } = await import("@/lib/message-api.server");
        return handleMessageSendRequest(request);
      },
    },
  },
});
