import { useEffect, useState, useSyncExternalStore } from "react";
import { Music2, Pause, Play, SkipForward, X } from "lucide-react";
import {
  getMusicState,
  getServerMusicState,
  subscribeMusic,
  pauseGameMusic,
  resumeGameMusic,
  nextGameMusic,
} from "@/lib/game-audio";

export function MusicNowPlayingToast() {
  const music = useSyncExternalStore(subscribeMusic, getMusicState, getServerMusicState);
  const [visible, setVisible] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  useEffect(() => {
    setVisible(!!music.track && music.soundEnabled);
    if (!music.track || !music.soundEnabled) return;
    const timer = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timer);
  }, [music.playbackId, music.soundEnabled, music.track, openCount]);
  if (!music.track || !music.soundEnabled) return null;
  if (!visible)
    return (
      <button
        type="button"
        aria-label="Open music player"
        onClick={() => setOpenCount((count) => count + 1)}
        className="fixed bottom-24 right-6 z-40 flex size-11 items-center justify-center rounded-full bg-zinc-950 text-emerald-400 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 md:bottom-6"
      >
        <Music2 size={20} />
      </button>
    );
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
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            aria-label={music.playing ? "Pause music" : "Resume music"}
            onClick={() => (music.playing ? pauseGameMusic() : void resumeGameMusic())}
            className="flex size-8 items-center justify-center rounded-full bg-emerald-400 text-zinc-950 hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {music.playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            aria-label="Next track"
            onClick={() => void nextGameMusic(true)}
            className="flex size-8 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <SkipForward size={17} />
          </button>
        </div>
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
