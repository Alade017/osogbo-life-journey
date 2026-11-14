import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/groups/voice/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleGroupVoiceUpload } = await import("@/lib/social-group-media.server");
        return handleGroupVoiceUpload(request);
      },
    },
  },
});
