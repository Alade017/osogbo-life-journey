import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  disableGameAudio,
  enableGameAudio,
  playGameSound,
  readGameAudioLevels,
  resumeGameMusic,
  setGameAudioLevels,
} from "@/lib/game-audio";

type Channel = "music" | "effects";
type Levels = ReturnType<typeof readGameAudioLevels>;

const DEFAULT_VOLUME: Record<Channel, number> = { music: 0.4, effects: 0.65 };

// Off is always 0. On uses the saved volume, falling back to the default.
function volumeFor(channel: Channel, on: boolean): number {
  if (!on) return 0;
  return readGameAudioLevels()[channel] || DEFAULT_VOLUME[channel];
}

function levelsFromProps(musicEnabled: boolean, effectsEnabled: boolean): Levels {
  return {
    ...readGameAudioLevels(),
    music: volumeFor("music", musicEnabled),
    effects: volumeFor("effects", effectsEnabled),
  };
}

// The audio graph has independent music and effects channels.
export function WorldAudioSettings({
  musicEnabled,
  effectsEnabled,
  onChannelChange,
}: {
  musicEnabled: boolean;
  effectsEnabled: boolean;
  onChannelChange: (
    channel: Channel,
    enabled: boolean,
  ) => Promise<boolean | void> | boolean | void;
}) {
  const [levels, setLevels] = useState<Levels>(() =>
    levelsFromProps(musicEnabled, effectsEnabled),
  );
  const [unavailable, setUnavailable] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [changing, setChanging] = useState(false);
  // A ref, not state, so the guard is current inside async handlers and effects.
  const busy = useRef(false);

  // Sync from the profile, but never while our own save is in flight:
  // toggle() already set the local levels to the value being saved.
  useEffect(() => {
    if (busy.current) return;
    setLevels(levelsFromProps(musicEnabled, effectsEnabled));
  }, [musicEnabled, effectsEnabled]);

  async function toggle(channel: Channel, on: boolean) {
    if (busy.current) return;
    busy.current = true;
    setChanging(true);
    setSaveError(false);

    const previous = levels;
    const next: Levels = { ...previous, [channel]: volumeFor(channel, on) };

    try {
      // Starting audio needs a user gesture; if the browser refuses, nothing changes.
      if (on && !(await enableGameAudio(next))) {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      setGameAudioLevels(next);
      setLevels(next);
      if (!next.music && !next.effects) await disableGameAudio();
      if (on && channel === "effects") playGameSound("ui");

      const saved = await onChannelChange(channel, on);
      if (saved === false) throw new Error("Audio preference was not saved");
    } catch {
      // Roll back to the state from before this click.
      setGameAudioLevels(previous);
      setLevels(previous);
      if (previous.music > 0 || previous.effects > 0) await enableGameAudio(previous);
      else await disableGameAudio();
      setSaveError(true);
    } finally {
      busy.current = false;
      setChanging(false);
    }
  }

  async function preview(channel: Channel) {
    if (busy.current) return;
    busy.current = true;
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
      busy.current = false;
      setChanging(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-xl border border-border p-3">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Music</span>
            <span className="text-xs text-muted-foreground">Background music during gameplay</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="min-w-6 text-xs text-muted-foreground" aria-hidden="true">
              {levels.music > 0 ? "On" : "Off"}
            </span>
            <Switch
              aria-label="Music"
              checked={levels.music > 0}
              disabled={changing}
              onCheckedChange={(value) => void toggle("music", value)}
            />
          </div>
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

      <div className="rounded-xl border border-border p-3">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Sound Effects</span>
            <span className="text-xs text-muted-foreground">
              Notifications, messages and game actions
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="min-w-6 text-xs text-muted-foreground" aria-hidden="true">
              {levels.effects > 0 ? "On" : "Off"}
            </span>
            <Switch
              aria-label="Sound effects"
              checked={levels.effects > 0}
              disabled={changing}
              onCheckedChange={(value) => void toggle("effects", value)}
            />
          </div>
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

      {unavailable && (
        <p role="status" className="text-sm text-muted-foreground">
          Audio is unavailable right now. Keep this tab in view and try again.
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

// import { useEffect, useState } from "react";
// import { Switch } from "@/components/ui/switch";
// import {
//   disableGameAudio,
//   enableGameAudio,
//   playGameSound,
//   readGameAudioLevels,
//   resumeGameMusic,
//   setGameAudioLevels,
// } from "@/lib/game-audio";

// // The audio graph has independent music and effects channels.
// export function WorldAudioSettings({
//   musicEnabled,
//   effectsEnabled,
//   onChannelChange,
// }: {
//   musicEnabled: boolean;
//   effectsEnabled: boolean;
//   onChannelChange: (
//     channel: "music" | "effects",
//     enabled: boolean,
//   ) => Promise<boolean | void> | boolean | void;
// }) {
//   const [levels, setLevels] = useState(() => {
//     const saved = readGameAudioLevels();
//     return {
//       ...saved,
//       music: musicEnabled ? saved.music || 0.4 : 0,
//       effects: effectsEnabled ? saved.effects || 0.65 : 0,
//     };
//   });
//   const [unavailable, setUnavailable] = useState(false);
//   const [saveError, setSaveError] = useState(false);
//   const [changing, setChanging] = useState(false);

//   // Profile updates can arrive after this screen first renders. Keep the
//   // controls truthful without resetting a change currently being saved.
//   useEffect(() => {
//     const saved = readGameAudioLevels();
//     setLevels({
//       ...saved,
//       music: musicEnabled ? saved.music || 0.4 : 0,
//       effects: effectsEnabled ? saved.effects || 0.65 : 0,
//     });
//   }, [musicEnabled, effectsEnabled]);

//   async function toggle(channel: "music" | "effects", checked: boolean) {
//     if (changing) return;
//     const next = { ...levels, [channel]: checked ? (channel === "music" ? 0.4 : 0.65) : 0 };
//     setChanging(true);
//     setSaveError(false);
//     try {
//       // Turning a channel off must never resume the audio context.
//       if (checked && !(await enableGameAudio(next))) {
//         setGameAudioLevels(levels);
//         setUnavailable(true);
//         return;
//       }
//       setGameAudioLevels(next);
//       setLevels(next);
//       if (!next.music && !next.effects) await disableGameAudio();
//       if (checked && channel === "effects") playGameSound("ui");
//       const saved = await onChannelChange(channel, checked);
//       if (saved === false) {
//         setGameAudioLevels(levels);
//         setLevels(levels);
//         if (levels.music || levels.effects) await enableGameAudio(levels);
//         else await disableGameAudio();
//         setSaveError(true);
//       } else {
//         setUnavailable(false);
//       }
//     } catch {
//       setGameAudioLevels(levels);
//       setLevels(levels);
//       if (levels.music || levels.effects) await enableGameAudio(levels);
//       else await disableGameAudio();
//       setSaveError(true);
//     } finally {
//       setChanging(false);
//     }
//   }

//   async function preview(channel: "music" | "effects") {
//     if (changing) return;
//     setChanging(true);
//     try {
//       if (!(await enableGameAudio(levels))) {
//         setUnavailable(true);
//         return;
//       }
//       setUnavailable(false);
//       if (channel === "effects") playGameSound("ui");
//       else await resumeGameMusic(true);
//     } finally {
//       setChanging(false);
//     }
//   }

//   return (
//     <div className="grid grid-cols-1 gap-3">
//       <div className="rounded-xl border border-border p-3">
//         <div className="flex min-h-12 items-center justify-between gap-4">
//           <span>
//             <span className="block font-semibold">Music</span>
//             <span className="text-xs text-muted-foreground">Background music during gameplay</span>
//           </span>
//           <div className="flex shrink-0 items-center gap-2">
//             <span className="min-w-6 text-xs text-muted-foreground" aria-hidden="true">
//               {levels.music > 0 ? "On" : "Off"}
//             </span>
//             <Switch
//               aria-label="Music"
//               checked={levels.music > 0}
//               disabled={changing}
//               onCheckedChange={(value) => void toggle("music", value)}
//             />
//           </div>
//         </div>
//         {levels.music > 0 && (
//           <button
//             type="button"
//             className="mt-2 text-xs font-semibold text-primary underline"
//             disabled={changing}
//             onClick={() => void preview("music")}
//           >
//             Play music
//           </button>
//         )}
//       </div>
//       <div className="rounded-xl border border-border p-3">
//         <div className="flex min-h-12 items-center justify-between gap-4">
//           <span>
//             <span className="block font-semibold">Sound Effects</span>
//             <span className="text-xs text-muted-foreground">
//               Notifications, messages and game actions
//             </span>
//           </span>
//           <div className="flex shrink-0 items-center gap-2">
//             <span className="min-w-6 text-xs text-muted-foreground" aria-hidden="true">
//               {levels.effects > 0 ? "On" : "Off"}
//             </span>
//             <Switch
//               aria-label="Sound effects"
//               checked={levels.effects > 0}
//               disabled={changing}
//               onCheckedChange={(value) => void toggle("effects", value)}
//             />
//           </div>
//         </div>
//         {levels.effects > 0 && (
//           <button
//             type="button"
//             className="mt-2 text-xs font-semibold text-primary underline"
//             disabled={changing}
//             onClick={() => void preview("effects")}
//           >
//             Play sound sample
//           </button>
//         )}
//       </div>
//       {unavailable && (
//         <p role="status" className="text-sm text-muted-foreground">
//           Audio is unavailable in this browser.
//         </p>
//       )}
//       {saveError && (
//         <p role="alert" className="text-sm text-muted-foreground">
//           Could not save audio settings. Try again.
//         </p>
//       )}
//     </div>
//   );
// }
