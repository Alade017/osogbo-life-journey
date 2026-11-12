import { School } from "lucide-react";
import { useExternalNews } from "@/components/game/phone/use-external-news";

/** Daily news on Nigerian schools: exams, admissions, school policy and student stories. */
export function NigerianSchoolsApp() {
  const news = useExternalNews("schools", true);

  return (
    <div className="phone-local-app schools-app" aria-label="Nigerian Schools news">
      <header>
        <School aria-hidden="true" />
        <span>
          <strong>Nigerian Schools</strong>
          <small>Daily news on schools across Nigeria</small>
        </span>
      </header>
      <div className="phone-local-list">
        {news.state === "loading" ? (
          <div className="phone-local-card">
            <small>Updating school news…</small>
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
            <small>No school news right now. Check back later today.</small>
          </div>
        ) : (
          <div className="phone-local-card">
            <small>School news is unavailable right now.</small>
          </div>
        )}
      </div>
    </div>
  );
}
