import { ExternalLink, Music2 } from "lucide-react";

export function SpotifyPlaylistLink() {
  return (
    <a
      href="https://open.spotify.com/playlist/37i9dQZEVXbKY7jLzlJ11V"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
    >
      <Music2 size={16} aria-hidden="true" />
      Top 50 Nigeria · Open Spotify
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}
