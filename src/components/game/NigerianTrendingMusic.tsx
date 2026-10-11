import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Music2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChartSong = {
  id: string;
  name: string;
  artistName: string;
  url: string;
  artworkUrl?: string;
};

const CHART_URL = "https://rss.marketingtools.apple.com/api/v2/ng/music/most-played/25/songs.json";
const REFRESH_MS = 30 * 60 * 1000;

function validSong(value: unknown): ChartSong | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = typeof item["id"] === "string" ? item["id"] : "";
  const name = typeof item["name"] === "string" ? item["name"] : "";
  const artistName = typeof item["artistName"] === "string" ? item["artistName"] : "";
  const url = typeof item["url"] === "string" ? item["url"] : "";
  const artwork =
    item["artwork"] && typeof item["artwork"] === "object"
      ? (item["artwork"] as Record<string, unknown>)["url"]
      : undefined;
  if (!id || !name || !artistName || !/^https:\/\/music\.apple\.com\//.test(url)) return null;
  return {
    id,
    name,
    artistName,
    url,
    ...(typeof artwork === "string" && /^https:\/\//.test(artwork) ? { artworkUrl: artwork } : {}),
  };
}

export function NigerianTrendingMusic() {
  const [songs, setSongs] = useState<ChartSong[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  const loadChart = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(CHART_URL, {
        headers: { Accept: "application/json" },
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new Error("The Nigeria music chart is temporarily unavailable.");
      const payload: unknown = await response.json();
      const feed =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)["feed"]
          : null;
      const results =
        feed && typeof feed === "object" ? (feed as Record<string, unknown>)["results"] : null;
      const next = Array.isArray(results)
        ? results.map(validSong).filter((song): song is ChartSong => song !== null)
        : [];
      if (!next.length) throw new Error("The chart returned no listings.");
      setSongs(next);
      setUpdatedAt(new Date());
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(
        cause instanceof Error && !(cause instanceof TypeError)
          ? cause.message
          : "Could not reach the Nigeria music chart. Check your connection and try again.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const refreshChart = useCallback(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    void loadChart(controller.signal).finally(() => {
      if (activeRequest.current === controller) activeRequest.current = null;
    });
  }, [loadChart]);

  useEffect(() => {
    refreshChart();
    const interval = window.setInterval(refreshChart, REFRESH_MS);
    return () => {
      window.clearInterval(interval);
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refreshChart]);

  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-labelledby="nigerian-chart-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="nigerian-chart-title" className="font-semibold">
            Trending in Nigeria
          </h3>
          <p className="text-xs text-muted-foreground">
            Apple Music Nigeria chart · refreshes every 30 minutes
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={refreshChart}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
      {loading && !songs.length && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading the latest chart…
        </p>
      )}
      {error && (
        <p role="status" className="text-sm text-muted-foreground">
          {error} {songs.length ? "Showing the last successfully loaded chart." : "The rest of Settings is still available."}
        </p>
      )}
      {songs.length > 0 && (
        <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {songs.map((song, index) => (
            <li
              key={song.id}
              className="flex items-center gap-3 rounded-md border border-border p-2"
            >
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              {song.artworkUrl ? (
                <img
                  src={song.artworkUrl}
                  alt=""
                  loading="lazy"
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  <Music2 size={17} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{song.name}</p>
                <p className="truncate text-xs text-muted-foreground">{song.artistName}</p>
              </div>
              <a
                href={song.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${song.name} by ${song.artistName} on Apple Music`}
                className="rounded p-2 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      )}
      {updatedAt && (
        <p className="text-xs text-muted-foreground">
          Last refreshed {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
          Songs open on Apple Music; this list does not stream copyrighted tracks inside the game.
        </p>
      )}
    </section>
  );
}
