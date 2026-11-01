import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/social/profile/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const { productionSocialMediaHandlers } = await import("@/lib/social-media-api.server");
        return (await productionSocialMediaHandlers()).clearCover(request, params.id);
      },
      GET: async ({ request, params }) => {
        const { productionSocialMediaHandlers } = await import("@/lib/social-media-api.server");
        return (await productionSocialMediaHandlers()).profile(request, params.id);
      },
    },
  },
});
