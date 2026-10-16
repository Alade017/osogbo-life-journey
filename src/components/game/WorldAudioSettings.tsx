import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { enableGameAudio, readGameAudioLevels, setGameAudioLevels } from "@/lib/game-audio";

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

  async function toggle(channel: "music" | "effects", checked: boolean) {
    const next = { ...levels, [channel]: checked ? (channel === "music" ? 0.2 : 0.45) : 0 };
    const active = await enableGameAudio(next);
    setUnavailable(!active);
    if (active) {
      setLevels(next);
      setGameAudioLevels(next);
      onEnabledChange(next.music > 0 || next.effects > 0);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span className="font-semibold">Sound effects</span>
        <Switch
          aria-label="Sound effects"
          checked={levels.effects > 0}
          onCheckedChange={(value) => void toggle("effects", value)}
        />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span className="font-semibold">Music</span>
        <Switch
          aria-label="Music"
          checked={levels.music > 0}
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
