import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/messages/media/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { productionSocialMediaHandlers } = await import("@/lib/social-media-api.server");
        return (await productionSocialMediaHandlers()).upload(request);
      },
    },
  },
});
