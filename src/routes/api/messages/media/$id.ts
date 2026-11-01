import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/messages/media/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { productionSocialMediaHandlers } = await import("@/lib/social-media-api.server");
        return (await productionSocialMediaHandlers()).download(request, params.id);
      },
    },
  },
});
