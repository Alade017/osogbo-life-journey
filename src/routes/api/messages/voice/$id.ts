import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/messages/voice/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleVoiceDownloadRequest } = await import("@/lib/voice-note-api.server");
        return handleVoiceDownloadRequest(request, params.id);
      },
    },
  },
});
