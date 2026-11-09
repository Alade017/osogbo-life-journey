import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer "))
          return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
        if (error || !data.user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { EXTERNAL_NEWS_REGIONS, getExternalNews } =
          await import("@/lib/external-news-api.server");
        const region = new URL(request.url).searchParams.get("region");
        if (!(EXTERNAL_NEWS_REGIONS as readonly string[]).includes(region ?? ""))
          return Response.json({ error: "INVALID_REGION" }, { status: 400 });
        const newsRegion = region as (typeof EXTERNAL_NEWS_REGIONS)[number];
        try {
          return Response.json(
            { region: newsRegion, items: await getExternalNews(newsRegion) },
            { headers: { "Cache-Control": "private, max-age=60" } },
          );
        } catch (newsError) {
          console.error("External news request failed", newsError);
          return Response.json({ error: "NEWS_UNAVAILABLE" }, { status: 503 });
        }
      },
    },
  },
});
