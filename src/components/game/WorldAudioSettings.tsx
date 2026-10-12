import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  disableGameAudio,
  enableGameAudio,
  isGameAudioActive,
  playGameSound,
  readGameAudioLevels,
  setGameAudioLevels,
  subscribeMusic,
  getMusicState,
  getServerMusicState,
  pauseGameMusic,
  resumeGameMusic,
  nextGameMusic,
  playableMusicTracks,
} from "@/lib/game-audio";

type Levels = ReturnType<typeof readGameAudioLevels>;

export function WorldAudioSettings({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const [levels, setLevels] = useState<Levels>(readGameAudioLevels);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const music = useSyncExternalStore(subscribeMusic, getMusicState, getServerMusicState);

  useEffect(() => {
    setAudioActive(isGameAudioActive());
  }, []);

  function setLevel(key: keyof Levels, value: number) {
    const next = { ...levels, [key]: value };
    setLevels(next);
    setGameAudioLevels(next);
  }

  async function toggleAudio() {
    if (audioActive) {
      await disableGameAudio();
      setAudioActive(false);
      onEnabledChange(false);
      return;
    }
    const active = await enableGameAudio(levels);
    setAudioActive(active);
    setAudioUnavailable(!active);
    if (active) onEnabledChange(true);
  }

  function previewEffect() {
    playGameSound("ui");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Original synthesized city ambience and game sounds. Audio starts only after you enable it.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={audioActive ? "outline" : "default"} onClick={() => void toggleAudio()}>
          {audioActive ? "Turn sound off" : "Enable sound"}
        </Button>
        {!audioActive && enabled && (
          <span className="text-xs text-muted-foreground">
            Your sound preference is saved · enable audio when ready
          </span>
        )}
        {audioUnavailable && (
          <span role="status" className="text-sm text-muted-foreground">
            Audio is unavailable in this browser; the game still works normally.
          </span>
        )}
      </div>
      <Button variant="outline" disabled={!audioActive} onClick={previewEffect}>
        Preview game sound
      </Button>
      {(["master", "music", "effects"] as const).map((key) => (
        <label key={key} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="capitalize">
            {key === "effects" ? "Effects" : key === "master" ? "Master" : "Music"}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={levels[key]}
            aria-label={`${key} volume`}
            onChange={(event) => setLevel(key, Number(event.target.value))}
          />
          <span className="tabular-nums">{Math.round(levels[key] * 100)}%</span>
        </label>
      ))}
      <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Now playing">
        <h4 className="font-semibold">Now playing</h4>
        <p role="status" className="text-sm text-muted-foreground">
          {music.status}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!audioActive || !playableMusicTracks.length}
            onClick={() => (music.playing ? pauseGameMusic() : void resumeGameMusic())}
          >
            {music.playing ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="outline"
            disabled={!audioActive || !playableMusicTracks.length}
            onClick={() => void nextGameMusic()}
          >
            Next
          </Button>
        </div>
      </section>
      <div className="text-sm">
        <a href="/audio/CREDITS.md" className="underline">
          Credits file
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Tracks are cached after loading for offline listening in this open game. Browser storage may
        be cleared or evicted. Synthesized city ambience and effects remain available.
      </p>
    </div>
  );
}
