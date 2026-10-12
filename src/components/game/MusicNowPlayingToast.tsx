import { useEffect, useState, useSyncExternalStore } from "react";
import { Music2, X } from "lucide-react";
import { getMusicState, getServerMusicState, subscribeMusic } from "@/lib/game-audio";

export function MusicNowPlayingToast() {
  const music = useSyncExternalStore(subscribeMusic, getMusicState, getServerMusicState);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(!!music.track && music.playing);
    if (!music.track || !music.playing) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [music.playbackId, music.playing, music.track]);
  if (!visible || !music.track || !music.playing) return null;
  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Now playing music"
      className="pointer-events-auto fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-4 text-white shadow-2xl md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
    >
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400"
        aria-hidden="true"
      >
        <Music2 size={25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
          Now playing · Osogbo Life
        </p>
        <p className="truncate text-sm font-semibold">{music.track.title}</p>
        <p className="truncate text-xs text-zinc-400">{music.track.artist}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss music notification"
        onClick={() => setVisible(false)}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        <X size={17} />
      </button>
    </aside>
  );
}
