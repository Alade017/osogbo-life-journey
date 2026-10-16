import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/messages/voice/cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleVoiceCleanupRequest } = await import("@/lib/voice-note-api.server");
        return handleVoiceCleanupRequest(request);
      },
    },
  },
});
