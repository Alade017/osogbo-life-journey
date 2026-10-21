import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  disableGameAudio,
  enableGameAudio,
  playGameSound,
  readGameAudioLevels,
  resumeGameMusic,
  setGameAudioLevels,
} from "@/lib/game-audio";

// The audio graph has independent music and effects channels.
export function WorldAudioSettings({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => Promise<boolean | void> | boolean | void;
}) {
  const [levels, setLevels] = useState(() => {
    const saved = readGameAudioLevels();
    return enabled ? saved : { ...saved, music: 0, effects: 0 };
  });
  const [unavailable, setUnavailable] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [changing, setChanging] = useState(false);

  // Profile updates can arrive after this screen first renders. Keep the
  // controls truthful without resetting a change currently being saved.
  useEffect(() => {
    const saved = readGameAudioLevels();
    setLevels(enabled ? saved : { ...saved, music: 0, effects: 0 });
  }, [enabled]);

  async function toggle(channel: "music" | "effects", checked: boolean) {
    if (changing) return;
    const next = { ...levels, [channel]: checked ? (channel === "music" ? 0.4 : 0.65) : 0 };
    setChanging(true);
    setSaveError(false);
    try {
      // Turning a channel off must never resume the audio context.
      if (checked && !(await enableGameAudio(next))) {
        setGameAudioLevels(levels);
        setUnavailable(true);
        return;
      }
      setGameAudioLevels(next);
      setLevels(next);
      if (!next.music && !next.effects) await disableGameAudio();
      if (checked && channel === "effects") playGameSound("ui");
      const saved = await onEnabledChange(next.music > 0 || next.effects > 0);
      if (saved === false) {
        setGameAudioLevels(levels);
        setLevels(levels);
        if (levels.music || levels.effects) await enableGameAudio(levels);
        else await disableGameAudio();
        setSaveError(true);
      } else {
        setUnavailable(false);
      }
    } catch {
      setGameAudioLevels(levels);
      setLevels(levels);
      if (levels.music || levels.effects) await enableGameAudio(levels);
      else await disableGameAudio();
      setSaveError(true);
    } finally {
      setChanging(false);
    }
  }

  async function preview(channel: "music" | "effects") {
    if (changing) return;
    setChanging(true);
    try {
      if (!(await enableGameAudio(levels))) {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      if (channel === "effects") playGameSound("ui");
      else await resumeGameMusic(true);
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-xl border border-border p-3">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Sound effects</span>
            <span className="text-xs text-muted-foreground">
              Notifications, messages and game actions
            </span>
          </span>
          <Switch
            aria-label="Sound effects"
            checked={levels.effects > 0}
            disabled={changing}
            onCheckedChange={(value) => void toggle("effects", value)}
          />
        </div>
        {levels.effects > 0 && (
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary underline"
            disabled={changing}
            onClick={() => void preview("effects")}
          >
            Play sound sample
          </button>
        )}
      </div>
      <div className="rounded-xl border border-border p-3">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Music</span>
            <span className="text-xs text-muted-foreground">Background music during gameplay</span>
          </span>
          <Switch
            aria-label="Music"
            checked={levels.music > 0}
            disabled={changing}
            onCheckedChange={(value) => void toggle("music", value)}
          />
        </div>
        {levels.music > 0 && (
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary underline"
            disabled={changing}
            onClick={() => void preview("music")}
          >
            Play music
          </button>
        )}
      </div>
      {unavailable && (
        <p role="status" className="text-sm text-muted-foreground">
          Audio is unavailable in this browser.
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-muted-foreground">
          Could not save audio settings. Try again.
        </p>
      )}
    </div>
  );
}
