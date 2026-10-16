import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/messages/voice/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleVoiceUploadRequest } = await import("@/lib/voice-note-api.server");
        return handleVoiceUploadRequest(request);
      },
    },
  },
});
