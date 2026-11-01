import { WorldAudioSettings } from "@/components/game/WorldAudioSettings";
import { readGameAudioLevels } from "@/lib/game-audio";

type AudioProfile = {
  music_enabled: boolean;
  effects_enabled: boolean;
  sound_enabled: boolean;
};

export function SettingsAudioPanel({
  profile,
  isPending,
  isError,
  error,
  isFetching,
  onRetry,
  onChannelChange,
}: {
  profile: AudioProfile | null | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  onRetry: () => void;
  onChannelChange: (channel: "music" | "effects", enabled: boolean) => Promise<boolean | void>;
}) {
  const local = readGameAudioLevels();
  return (
    <section className="game-panel space-y-3 p-5" aria-labelledby="audio-settings-heading">
      <div>
        <h2 id="audio-settings-heading" className="text-xl font-bold">
          Audio
        </h2>
        <p className="text-sm text-muted-foreground">
          Set background music and game sound effects separately.
        </p>
      </div>
      <WorldAudioSettings
        key={profile ? "account" : "browser"}
        musicEnabled={profile ? (profile.music_enabled ?? profile.sound_enabled) : local.music > 0}
        effectsEnabled={
          profile ? (profile.effects_enabled ?? profile.sound_enabled) : local.effects > 0
        }
        onChannelChange={profile ? onChannelChange : () => true}
      />
      {!profile && (
        <p className="text-sm text-muted-foreground">
          These controls currently apply only to this browser. Saved account preferences take effect
          when your profile loads.
        </p>
      )}
      {!profile &&
        (isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading audio settings…
          </p>
        ) : (
          <div role="alert" className="space-y-2 text-sm text-muted-foreground">
            <p>
              {isError
                ? `Could not load audio settings${error?.message ? `: ${error.message}` : "."}`
                : "Saved audio preferences are unavailable because this account profile could not be found."}
            </p>
            <button
              type="button"
              className="font-semibold text-primary underline"
              disabled={isFetching}
              onClick={onRetry}
            >
              {isFetching ? "Retrying…" : "Retry"}
            </button>
          </div>
        ))}
    </section>
  );
}
