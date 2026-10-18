import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  disableGameAudio,
  enableGameAudio,
  readGameAudioLevels,
  setGameAudioLevels,
} from "@/lib/game-audio";

// The audio graph has independent music and effects channels.
export function WorldAudioSettings({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const [levels, setLevels] = useState(() => {
    const saved = readGameAudioLevels();
    return enabled ? saved : { ...saved, music: 0, effects: 0 };
  });
  const [unavailable, setUnavailable] = useState(false);
  const [changing, setChanging] = useState(false);

  async function toggle(channel: "music" | "effects", checked: boolean) {
    if (changing) return;
    const next = { ...levels, [channel]: checked ? (channel === "music" ? 0.2 : 0.45) : 0 };
    setChanging(true);
    try {
      // Turning a channel off must never resume the audio context.
      if (checked && !(await enableGameAudio(next))) {
        setGameAudioLevels(levels);
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      setGameAudioLevels(next);
      setLevels(next);
      if (!next.music && !next.effects) await disableGameAudio();
      onEnabledChange(next.music > 0 || next.effects > 0);
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-border p-3">
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
      </label>
      <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-border p-3">
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
      </label>
      {unavailable && (
        <p role="status" className="text-sm text-muted-foreground">
          Audio is unavailable in this browser.
        </p>
      )}
    </div>
  );
}
