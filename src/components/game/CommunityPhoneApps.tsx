import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, Newspaper, Plus, Send, Trophy } from "lucide-react";
import { PaletteSelect } from "@/components/ui/palette-select";
import { loadGameUpdates, sortGameUpdates } from "@/lib/game-updates";
import "./phone/phone-leaderboard.css";

export type CommunityPhoneApp =
  "Calendar" | "Food Delivery" | "Okada Rides" | "Contribution" | "Leaderboard" | "Town News";

type TownRank = { rank: number; name: string; score: number };
type TownPost = { id: string; category: string; title: string; body: string; created_at: string };
type TownReaction = { post_id: string; user_id: string };
type TownComment = { id: string; post_id: string; body: string; created_at: string };

export function CommunityPhoneApps({ app }: { app: CommunityPhoneApp }) {
  const queryClient = useQueryClient();
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
      const { data, error } = await supabase.rpc("get_town_leaderboard");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as TownRank[];
    },
  });
  const gameUpdates = useQuery({
    queryKey: ["phoneGameUpdates"],
    enabled: app === "Town News",
    queryFn: loadGameUpdates,
  });
  const townPosts = useQuery({
    queryKey: ["phoneTownNewsPosts"],
    enabled: app === "Town News",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("town_news_posts")
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
      const { data, error } = await supabase.from("town_news_reactions").select("post_id,user_id");
      if (error) throw error;
      return (data ?? []) as TownReaction[];
    },
  });
  const comments = useQuery({
    queryKey: ["phoneTownNewsComments"],
    enabled: app === "Town News",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("town_news_comments")
        .select("id,post_id,body,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TownComment[];
    },
  });
  const toggleReaction = useMutation({
    mutationFn: async ({ postId, reacted }: { postId: string; reacted: boolean }) => {
      const { error } = await supabase.rpc("toggle_town_news_reaction", {
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
      const { error } = await supabase.rpc("create_town_news_comment", {
        p_post_id: postId,
        p_body: (commentDrafts[postId] ?? "").trim(),
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
      const { error } = await supabase.rpc("create_town_news_post", {
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
      <div className="phone-local-app leaderboard-app" aria-label="Town leaderboard">
        <header>
          <Trophy aria-hidden="true" />
          <span>
            <strong>Town leaderboard</strong>
            <small>This week · community activity</small>
          </span>
        </header>
        <ol className="phone-local-ranks leaderboard-ranks">
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

  const postCount = townPosts.data?.length ?? 0;
  const updateCount = gameUpdates.data?.length ?? 0;
  const reactionsFor = (postId: string) =>
    reactions.data?.filter((reaction) => reaction.post_id === postId) ?? [];
  const likedByMe = (postId: string) =>
    reactionsFor(postId).some((reaction) => reaction.user_id === newsUser.data);

  return (
    <section className="town-news" aria-label="Town news feed">
      <header className="town-news-hero">
        <span className="town-news-hero-icon" aria-hidden="true">
          <Newspaper />
        </span>
        <div>
          <strong>Town News</strong>
          <small>
            {postCount} town {postCount === 1 ? "post" : "posts"} · {updateCount} game{" "}
            {updateCount === 1 ? "update" : "updates"}
          </small>
        </div>
      </header>

      <section className="town-news-section" aria-labelledby="phone-game-updates">
        <h3 id="phone-game-updates" className="town-news-heading">
          Game updates
        </h3>
        {gameUpdates.isLoading && <p className="town-news-state">Loading game updates…</p>}
        {gameUpdates.isError && (
          <p className="town-news-state" role="alert">
            Game updates could not be loaded.
          </p>
        )}
        <ul className="town-news-updates">
          {sortGameUpdates(gameUpdates.data ?? []).map((update) => (
            <li key={update.id} className="town-news-update">
              <span className="town-news-tag">{update.app}</span>
              <time dateTime={`${update.publishedOn}T00:00:00`}>
                {new Date(`${update.publishedOn}T00:00:00`).toLocaleDateString("en-NG")}
              </time>
              <strong>{update.title}</strong>
              <span>{update.summary}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="town-news-section" aria-labelledby="town-news-posts-heading">
        <h3 id="town-news-posts-heading" className="town-news-heading">
          Town posts
        </h3>
        {townPosts.isLoading ? (
          <p className="town-news-state">Loading town posts…</p>
        ) : townPosts.isError ? (
          <p className="town-news-state" role="alert">
            Town posts are unavailable.{" "}
            <button
              type="button"
              className="town-news-retry"
              onClick={() => void townPosts.refetch()}
            >
              Try again
            </button>
          </p>
        ) : postCount ? (
          <ul className="town-news-feed">
            {townPosts.data?.map((post) => {
              const liked = likedByMe(post.id);
              const count = reactionsFor(post.id).length;
              return (
                <li key={post.id} className="town-news-card">
                  <div className="town-news-meta">
                    <span
                      className={`town-news-chip town-news-chip-${post.category.toLowerCase()}`}
                    >
                      {post.category}
                    </span>
                    <time dateTime={post.created_at}>
                      {new Date(post.created_at).toLocaleDateString("en-NG")}
                    </time>
                  </div>
                  <h4 className="town-news-title">{post.title}</h4>
                  <p className="town-news-body">{post.body}</p>
                  <div className="town-news-actions">
                    <button
                      type="button"
                      className="town-news-like"
                      disabled={toggleReaction.isPending || !newsUser.data}
                      aria-pressed={liked}
                      onClick={() => toggleReaction.mutate({ postId: post.id, reacted: !liked })}
                    >
                      <Heart
                        aria-hidden="true"
                        className="town-news-heart"
                        fill={liked ? "currentColor" : "none"}
                      />
                      <span>Like · {count}</span>
                    </button>
                  </div>
                  {comments.data?.some((comment) => comment.post_id === post.id) && (
                    <ul className="town-news-comments" aria-label={`Comments on ${post.title}`}>
                      {comments.data
                        .filter((comment) => comment.post_id === post.id)
                        .map((comment) => (
                          <li key={comment.id}>{comment.body}</li>
                        ))}
                    </ul>
                  )}
                  <form
                    className="town-news-comment-form"
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
                      placeholder="Write a comment"
                    />
                    <button
                      type="submit"
                      className="town-news-send"
                      aria-label="Post comment"
                      disabled={addComment.isPending || !commentDrafts[post.id]?.trim()}
                    >
                      <Send aria-hidden="true" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="town-news-state">No town posts yet. Share the first update.</p>
        )}
      </section>

      <button
        type="button"
        className="town-news-compose-toggle"
        aria-expanded={showComposer}
        onClick={() => setShowComposer((value) => !value)}
      >
        {showComposer ? (
          "Close composer"
        ) : (
          <>
            <Plus aria-hidden="true" /> Share a town update
          </>
        )}
      </button>
      {showComposer && (
        <form
          className="town-news-composer"
          onSubmit={(event) => {
            event.preventDefault();
            createPost.mutate();
          }}
        >
          <label>
            Category
            <PaletteSelect
              value={postCategory}
              onValueChange={setPostCategory}
              options={["Community", "Market", "Sports", "General"].map((name) => ({
                value: name,
                label: name,
              }))}
            />
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
          <button type="submit" className="town-news-submit" disabled={createPost.isPending}>
            {createPost.isPending ? "Posting…" : "Post update"}
          </button>
        </form>
      )}
    </section>
  );
}
