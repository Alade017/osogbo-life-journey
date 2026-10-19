import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ExternalNewsRegion = "nigeria" | "world";
export type ExternalNewsItem = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
};

const REFRESH_MS = 15 * 60 * 1000;
const MAX_ITEMS = 20;
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

function queryFor(region: ExternalNewsRegion) {
  return region === "nigeria" ? "sourcecountry:nigeria" : "(world OR international)";
}

function safeText(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sourceName(url: string, value: unknown) {
  const supplied = safeText(value, 120);
  if (supplied) return supplied;
  try {
    return new URL(url).hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return "News source";
  }
}

export function mapGdeltArticles(region: ExternalNewsRegion, payload: unknown) {
  const articles = (payload as { articles?: unknown })?.articles;
  if (!Array.isArray(articles)) return [];
  const seen = new Set<string>();
  return articles.flatMap((entry) => {
    const item = entry as Record<string, unknown>;
    const sourceUrl = safeText(item["url"], 2000);
    const title = safeText(item["title"], 300);
    if (!sourceUrl || !title || !/^https?:\/\//.test(sourceUrl) || seen.has(sourceUrl)) return [];
    seen.add(sourceUrl);
    return [{
      region,
      provider: "gdelt",
      source_name: sourceName(sourceUrl, item["domain"]),
      source_url: sourceUrl,
      title,
      published_at: parseDate(item["seendate"]),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }];
  });
}

async function refresh(region: ExternalNewsRegion) {
  const url = new URL(GDELT_URL);
  url.searchParams.set("query", queryFor(region));
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(MAX_ITEMS));
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  const items = mapGdeltArticles(region, await response.json());
  if (!items.length) throw new Error("Provider returned no usable headlines");
  const db = supabaseAdmin as any;
  const { error } = await db.from("external_news_items").upsert(items, { onConflict: "source_url" });
  if (error) throw error;
  await db.from("external_news_refreshes").upsert({ region, provider: "gdelt", refreshed_at: new Date().toISOString(), failed_at: null, failure_message: null, updated_at: new Date().toISOString() });
}

export async function getExternalNews(region: ExternalNewsRegion): Promise<ExternalNewsItem[]> {
  const db = supabaseAdmin as any;
  const { data: refreshRow } = await db.from("external_news_refreshes").select("refreshed_at").eq("region", region).maybeSingle();
  const refreshedAt = refreshRow?.refreshed_at ? Date.parse(refreshRow.refreshed_at) : 0;
  if (!refreshedAt || Date.now() - refreshedAt > REFRESH_MS) {
    try {
      await refresh(region);
    } catch (error) {
      await db.from("external_news_refreshes").upsert({ region, provider: "gdelt", failed_at: new Date().toISOString(), failure_message: error instanceof Error ? error.message.slice(0, 300) : "Refresh failed", updated_at: new Date().toISOString() });
    }
  }
  const { data, error } = await db.from("external_news_items").select("id,title,source_name,source_url,published_at").eq("region", region).gt("expires_at", new Date().toISOString()).order("published_at", { ascending: false, nullsFirst: false }).limit(MAX_ITEMS);
  if (error) throw error;
  return (data ?? []).map((item: any) => ({ id: item.id, title: item.title, sourceName: item.source_name, sourceUrl: item.source_url, publishedAt: item.published_at }));
}
