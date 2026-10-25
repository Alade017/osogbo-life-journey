import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Newspaper, Trophy } from "lucide-react";

export type CommunityPhoneApp =
  "Calendar" | "Food Delivery" | "Okada Rides" | "Contribution" | "Leaderboard" | "Town News";

type ExternalNewsItem = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
};

type TownRank = { rank: number; name: string; score: number };
type TownPost = { id: string; category: string; title: string; body: string; created_at: string };
type TownReaction = { post_id: string; user_id: string };
type TownComment = { id: string; post_id: string; body: string; created_at: string };

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
  const [newsRegion, setNewsRegion] = useState<"nigeria" | "world">("nigeria");
  const externalNews = useExternalNews(newsRegion, app === "Town News");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState("Community");
  const [showComposer, setShowComposer] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const newsUser = useQuery({
    queryKey: ["phoneTownNewsUser"],
    enabled: app === "Town News",
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });
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
  const reactions = useQuery({
    queryKey: ["phoneTownNewsReactions"],
    enabled: app === "Town News",
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("town_news_reactions").select(
        "post_id,user_id",
      );
      if (error) throw error;
      return (data ?? []) as TownReaction[];
    },
  });
  const comments = useQuery({
    queryKey: ["phoneTownNewsComments"],
    enabled: app === "Town News",
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("town_news_comments")
        .select("id,post_id,body,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TownComment[];
    },
  });
  const toggleReaction = useMutation({
    mutationFn: async ({ postId, reacted }: { postId: string; reacted: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("toggle_town_news_reaction", {
        p_post_id: postId,
        p_reacted: reacted,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["phoneTownNewsReactions"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const addComment = useMutation({
    mutationFn: async (postId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("create_town_news_comment", {
        p_post_id: postId,
        p_body: commentDrafts[postId]?.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, postId) => {
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["phoneTownNewsComments"] });
    },
    onError: (error: Error) => toast.error(error.message),
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
                <div className="phone-town-social">
                  <button
                    type="button"
                    disabled={toggleReaction.isPending || !newsUser.data}
                    aria-pressed={
                      reactions.data?.some(
                        (reaction) =>
                          reaction.post_id === post.id && reaction.user_id === newsUser.data,
                      ) ?? false
                    }
                    onClick={() =>
                      toggleReaction.mutate({
                        postId: post.id,
                        reacted: !reactions.data?.some(
                          (reaction) =>
                            reaction.post_id === post.id && reaction.user_id === newsUser.data,
                        ),
                      })
                    }
                  >
                    Like ·{" "}
                    {reactions.data?.filter((reaction) => reaction.post_id === post.id).length ?? 0}
                  </button>
                  {comments.data
                    ?.filter((comment) => comment.post_id === post.id)
                    .map((comment) => (
                      <p key={comment.id} className="phone-town-comment">
                        {comment.body}
                      </p>
                    ))}
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      addComment.mutate(post.id);
                    }}
                  >
                    <input
                      aria-label={`Comment on ${post.title}`}
                      maxLength={400}
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({
                          ...current,
                          [post.id]: event.target.value,
                        }))
                      }
                      placeholder="Add a comment"
                    />
                    <button
                      type="submit"
                      disabled={addComment.isPending || !commentDrafts[post.id]?.trim()}
                    >
                      Post
                    </button>
                  </form>
                </div>
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
