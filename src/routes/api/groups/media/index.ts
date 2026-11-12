import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/groups/media/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleGroupPictureUpload } = await import("@/lib/social-group-media.server");
        return handleGroupPictureUpload(request);
      },
    },
  },
});
