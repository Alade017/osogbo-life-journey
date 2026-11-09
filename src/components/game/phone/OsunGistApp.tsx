import { Newspaper } from "lucide-react";
import { useExternalNews } from "@/components/game/phone/use-external-news";

/** Osun State headlines only, cached on the server for the Osun region. */
export function OsunGistApp() {
  const news = useExternalNews("osun", true);

  return (
    <div className="phone-local-app" aria-label="Osun Gist headlines">
      <header>
        <Newspaper aria-hidden="true" />
        <span>
          <strong>Osun Gist</strong>
          <small>Osun State headlines</small>
        </span>
      </header>
      <div className="phone-local-list">
        {news.state === "loading" ? (
          <div className="phone-local-card">
            <small>Updating Osun headlines…</small>
          </div>
        ) : news.state === "ready" && news.items.length ? (
          news.items.map((story) => (
            <div className="phone-local-card" key={story.id}>
              <div>
                <small>
                  {story.sourceName}
                  {story.publishedAt
                    ? ` · ${new Date(story.publishedAt).toLocaleDateString("en-NG")}`
                    : ""}
                </small>
                <strong>{story.title}</strong>
              </div>
              <a href={story.sourceUrl} target="_blank" rel="noreferrer">
                Read more
              </a>
            </div>
          ))
        ) : news.state === "ready" ? (
          <div className="phone-local-card">
            <small>No Osun State headlines right now.</small>
          </div>
        ) : (
          <div className="phone-local-card">
            <small>Osun headlines are unavailable right now.</small>
          </div>
        )}
      </div>
    </div>
  );
}
