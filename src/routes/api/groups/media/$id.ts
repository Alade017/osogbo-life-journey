import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/groups/media/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleGroupMediaLink } = await import("@/lib/social-group-media.server");
        return handleGroupMediaLink(request, params.id);
      },
    },
  },
});
