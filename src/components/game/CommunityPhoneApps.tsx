import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  Bike,
  CalendarDays,
  ChevronRight,
  Newspaper,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";

export type CommunityPhoneApp =
  "Calendar" | "Food Delivery" | "Okada Rides" | "Contribution" | "Leaderboard" | "Town News";

const agenda = [
  { time: "09:00", title: "Market fresh-stock drop", place: "Oja-ọba Market" },
  { time: "14:00", title: "Community football practice", place: "Freedom Park" },
  { time: "18:30", title: "Neighbourhood meeting", place: "Oke-Fia Hall" },
];
const meals = [
  { name: "Amala & ewedu", shop: "Iya Mufu Kitchen", price: 1800, eta: "22–30 min" },
  { name: "Jollof rice bowl", shop: "Adebayo Bites", price: 2200, eta: "25–35 min" },
  { name: "Suya wrap", shop: "Sabo Grill", price: 1500, eta: "18–25 min" },
];
const riders = ["Oja-ọba Market", "Freedom Park", "Oke-Fia Bus Stop", "Osun Mall"];

type ExternalNewsItem = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
};

type TownRank = { rank: number; name: string; score: number };
type TownPost = { id: string; category: string; title: string; body: string; created_at: string };

function useExternalNews(region: "nigeria" | "world", enabled: boolean) {
  const [items, setItems] = useState<ExternalNewsItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    async function load() {
      setState("loading");
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) throw new Error("No active session");
        const response = await fetch(`/api/news?region=${region}`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (!response.ok) throw new Error("News is unavailable");
        const payload = (await response.json()) as { items?: ExternalNewsItem[] };
        if (live) {
          setItems(payload.items ?? []);
          setState("ready");
        }
      } catch {
        if (live) setState("unavailable");
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [region, enabled]);

  return { items, state };
}

function AppCard({ children }: { children: ReactNode }) {
  return <div className="phone-local-card">{children}</div>;
}

export function CommunityPhoneApps({ app }: { app: CommunityPhoneApp }) {
  const queryClient = useQueryClient();
  const [basket, setBasket] = useState<string[]>([]);
  const [destination, setDestination] = useState(riders[0]);
  const [rideRequested, setRideRequested] = useState(false);
  const [contribution, setContribution] = useState(500);
  const [contributed, setContributed] = useState(false);
  const [newsRegion, setNewsRegion] = useState<"nigeria" | "world">("nigeria");
  const externalNews = useExternalNews(newsRegion, app === "Town News");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState("Community");
  const [showComposer, setShowComposer] = useState(false);
  const leaderboard = useQuery({
    queryKey: ["phoneTownLeaderboard"],
    enabled: app === "Leaderboard",
    queryFn: async () => {
      // The generated database types do not yet include migration 0060.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_town_leaderboard");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as TownRank[];
    },
  });
  const townPosts = useQuery({
    queryKey: ["phoneTownNewsPosts"],
    enabled: app === "Town News",
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("town_news_posts")
        .select("id,category,title,body,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as TownPost[];
    },
  });
  const createPost = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("create_town_news_post", {
        p_category: postCategory,
        p_title: postTitle.trim(),
        p_body: postBody.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostTitle("");
      setPostBody("");
      setShowComposer(false);
      void queryClient.invalidateQueries({ queryKey: ["phoneTownNewsPosts"] });
    },
  });
  const foodTotal = useMemo(
    () =>
      meals.filter((meal) => basket.includes(meal.name)).reduce((sum, meal) => sum + meal.price, 0),
    [basket],
  );

  if (app === "Calendar")
    return (
      <div className="phone-local-app" aria-label="Town calendar">
        <header>
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>Today in Osogbo</strong>
            <small>Tuesday · 3 local events</small>
          </span>
        </header>
        <div className="phone-local-list">
          {agenda.map((event) => (
            <AppCard key={event.title}>
              <time>{event.time}</time>
              <div>
                <strong>{event.title}</strong>
                <small>{event.place}</small>
              </div>
              <ChevronRight aria-hidden="true" />
            </AppCard>
          ))}
        </div>
        <button
          type="button"
          className="phone-local-action"
          onClick={() => window.alert("Reminder saved for this browser session.")}
        >
          <Bell aria-hidden="true" /> Add a reminder
        </button>
      </div>
    );

  if (app === "Food Delivery")
    return (
      <div className="phone-local-app" aria-label="Food delivery">
        <header>
          <UtensilsCrossed aria-hidden="true" />
          <span>
            <strong>Food delivery</strong>
            <small>Local kitchens · mock ordering only</small>
          </span>
        </header>
        <div className="phone-local-list">
          {meals.map((meal) => {
            const chosen = basket.includes(meal.name);
            return (
              <AppCard key={meal.name}>
                <div>
                  <strong>{meal.name}</strong>
                  <small>
                    {meal.shop} · {meal.eta}
                  </small>
                  <b>₦{meal.price.toLocaleString("en-NG")}</b>
                </div>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() =>
                    setBasket((items) =>
                      chosen ? items.filter((item) => item !== meal.name) : [...items, meal.name],
                    )
                  }
                >
                  {chosen ? "Added" : "Add"}
                </button>
              </AppCard>
            );
          })}
        </div>
        <footer>
          <span>
            {basket.length
              ? `${basket.length} item${basket.length === 1 ? "" : "s"}`
              : "Your basket is empty"}
          </span>
          <button
            type="button"
            disabled={!basket.length}
            onClick={() => window.alert("Your mock order is being prepared.")}
          >
            Order · ₦{foodTotal.toLocaleString("en-NG")}
          </button>
        </footer>
      </div>
    );

  if (app === "Okada Rides")
    return (
      <div className="phone-local-app" aria-label="Okada rides">
        <header>
          <Bike aria-hidden="true" />
          <span>
            <strong>Okada rides</strong>
            <small>Quick local trips</small>
          </span>
        </header>
        <label className="phone-local-field">
          Destination
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            {riders.map((place) => (
              <option key={place}>{place}</option>
            ))}
          </select>
        </label>
        <AppCard>
          <div>
            <strong>{rideRequested ? "Rider is on the way" : "Pickup: your current area"}</strong>
            <small>
              {rideRequested
                ? "Blue helmet · arriving in 4 minutes"
                : `${destination} · about 8 minutes`}
            </small>
          </div>
          <b>₦650</b>
        </AppCard>
        <button
          type="button"
          className="phone-local-action"
          onClick={() => setRideRequested((value) => !value)}
        >
          {rideRequested ? "Cancel ride" : "Request a ride"}
        </button>
      </div>
    );

  if (app === "Contribution")
    return (
      <div className="phone-local-app" aria-label="Community contribution">
        <header>
          <span>
            <strong>Oke-Fia community fund</strong>
            <small>Mock group contribution</small>
          </span>
          <b>68%</b>
        </header>
        <AppCard>
          <div>
            <strong>Streetlight repairs</strong>
            <small>₦68,000 of ₦100,000 pledged</small>
            <progress value="68" max="100">
              68%
            </progress>
          </div>
        </AppCard>
        <label className="phone-local-field">
          Contribution amount
          <input
            type="number"
            min="100"
            step="100"
            value={contribution}
            onChange={(event) => setContribution(Number(event.target.value))}
          />
        </label>
        <button type="button" className="phone-local-action" onClick={() => setContributed(true)}>
          {contributed
            ? "Contribution noted"
            : `Contribute ₦${contribution.toLocaleString("en-NG")}`}
        </button>
        <small className="phone-local-note">
          This is a local preview; no money or game balance changes.
        </small>
      </div>
    );

  if (app === "Leaderboard")
    return (
      <div className="phone-local-app" aria-label="Town leaderboard">
        <header>
          <Trophy aria-hidden="true" />
          <span>
            <strong>Town leaderboard</strong>
            <small>This week · community activity</small>
          </span>
        </header>
        <ol className="phone-local-ranks">
          {leaderboard.isLoading ? (
            <li role="status">Loading town rankings...</li>
          ) : leaderboard.isError ? (
            <li role="alert">
              Rankings are unavailable.{" "}
              <button type="button" onClick={() => void leaderboard.refetch()}>
                Try again
              </button>
            </li>
          ) : leaderboard.data?.length ? (
            leaderboard.data.map(({ rank, name, score }) => (
              <li key={rank}>
                <b>{rank}</b>
                <span>
                  <strong>{name}</strong>
                  <small>{score.toLocaleString("en-NG")} level and XP points</small>
                </span>
                <Trophy aria-hidden="true" />
              </li>
            ))
          ) : (
            <li>No ranked players yet.</li>
          )}
        </ol>
      </div>
    );

  return (
    <div className="phone-local-app" aria-label="Town news feed">
      <header>
        <Newspaper aria-hidden="true" />
        <span>
          <strong>News feed</strong>
          <small>Nigeria, world, and town updates</small>
        </span>
      </header>
      <div className="phone-local-tabs" role="tablist" aria-label="News source">
        <button
          type="button"
          role="tab"
          aria-selected={newsRegion === "nigeria"}
          onClick={() => setNewsRegion("nigeria")}
        >
          Nigeria
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={newsRegion === "world"}
          onClick={() => setNewsRegion("world")}
        >
          World
        </button>
      </div>
      <div className="phone-local-list">
        {externalNews.state === "loading" ? (
          <AppCard>
            <small>Updating {newsRegion === "nigeria" ? "Nigeria" : "world"} headlines…</small>
          </AppCard>
        ) : externalNews.state === "ready" && externalNews.items.length ? (
          externalNews.items.map((story) => (
            <AppCard key={story.id}>
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
                Read
              </a>
            </AppCard>
          ))
        ) : (
          <AppCard>
            <small>
              Live headlines are temporarily unavailable. Town updates are still available below.
            </small>
          </AppCard>
        )}
        {townPosts.isLoading ? (
          <AppCard>
            <small>Loading town posts...</small>
          </AppCard>
        ) : townPosts.isError ? (
          <AppCard>
            <small role="alert">
              Town posts are unavailable.{" "}
              <button type="button" onClick={() => void townPosts.refetch()}>
                Try again
              </button>
            </small>
          </AppCard>
        ) : townPosts.data?.length ? (
          townPosts.data.map((post) => (
            <AppCard key={post.id}>
              <div>
                <small>
                  {post.category} · {new Date(post.created_at).toLocaleDateString("en-NG")}
                </small>
                <strong>{post.title}</strong>
                <p>{post.body}</p>
              </div>
            </AppCard>
          ))
        ) : (
          <AppCard>
            <small>No town posts yet. Share the first update.</small>
          </AppCard>
        )}
      </div>
      <button
        type="button"
        className="phone-local-action"
        onClick={() => setShowComposer((value) => !value)}
      >
        {showComposer ? "Close composer" : "Share a town update"}
      </button>
      {showComposer && (
        <form
          className="phone-town-composer"
          onSubmit={(event) => {
            event.preventDefault();
            createPost.mutate();
          }}
        >
          <label>
            Category
            <select value={postCategory} onChange={(event) => setPostCategory(event.target.value)}>
              <option>Community</option>
              <option>Market</option>
              <option>Sports</option>
              <option>General</option>
            </select>
          </label>
          <label>
            Title
            <input
              required
              minLength={3}
              maxLength={120}
              value={postTitle}
              onChange={(event) => setPostTitle(event.target.value)}
            />
          </label>
          <label>
            Update
            <textarea
              required
              minLength={3}
              maxLength={1000}
              rows={4}
              value={postBody}
              onChange={(event) => setPostBody(event.target.value)}
            />
          </label>
          {createPost.isError && <p role="alert">{createPost.error.message}</p>}
          <button type="submit" className="phone-local-action" disabled={createPost.isPending}>
            {createPost.isPending ? "Posting..." : "Post update"}
          </button>
        </form>
      )}
    </div>
  );
}
