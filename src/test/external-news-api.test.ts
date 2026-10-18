import { describe, expect, it } from "vitest";
import { mapGdeltArticles } from "@/lib/external-news-api.server";

describe("external news mapping", () => {
  it("keeps headline metadata and rejects invalid provider entries", () => {
    const entries = mapGdeltArticles("nigeria", {
      articles: [
        { title: "Nigeria headline", url: "https://news.example/article", domain: "news.example", seendate: "2026-10-18T12:00:00Z" },
        { title: "Broken", url: "javascript:alert(1)" },
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ region: "nigeria", provider: "gdelt", title: "Nigeria headline", source_name: "news.example" });
  });
});
