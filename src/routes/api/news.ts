import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
        if (error || !data.user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const region = new URL(request.url).searchParams.get("region");
        if (region !== "nigeria" && region !== "world") return Response.json({ error: "INVALID_REGION" }, { status: 400 });
        const { getExternalNews } = await import("@/lib/external-news-api.server");
        try {
          return Response.json({ region, items: await getExternalNews(region) }, { headers: { "Cache-Control": "private, max-age=60" } });
        } catch (newsError) {
          console.error("External news request failed", newsError);
          return Response.json({ error: "NEWS_UNAVAILABLE" }, { status: 503 });
        }
      },
    },
  },
});
