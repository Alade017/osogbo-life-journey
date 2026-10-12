import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  disableGameAudio,
  enableGameAudio,
  subscribeMusic,
  getMusicState,
  getServerMusicState,
} from "@/lib/game-audio";

export function WorldAudioSettings({
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const audio = useSyncExternalStore(subscribeMusic, getMusicState, getServerMusicState);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (audio.soundEnabled) {
        await disableGameAudio();
        onEnabledChange(false);
      } else {
        const active = await enableGameAudio();
        setUnavailable(!active);
        if (active) onEnabledChange(true);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Button
        variant={audio.soundEnabled ? "outline" : "default"}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {audio.soundEnabled ? "Turn sound off" : "Enable sound"}
      </Button>
      {unavailable && (
        <p role="status" className="text-sm text-muted-foreground">
          Sound is unavailable in this browser.
        </p>
      )}
    </div>
  );
}
