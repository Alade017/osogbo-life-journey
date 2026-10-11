import { type MusicTrack, validMusicTracks } from "./music-tracks.ts";

export type SoundName = "ui" | "interaction" | "player" | "message" | "level-up";
export type SoundEffect = MusicTrack & { sound: SoundName };
export const soundEffects: SoundEffect[] = [
  {
    id: "mixkit-level-increased-2062",
    sound: "level-up",
    title: "Game experience level increased",
    artist: "Mixkit (individual creator not identified)",
    uploader: "Mixkit",
    filePath: "/audio/sfx/mixkit-level-increased-2062.wav",
    duration: 3.098,
    sourceUrl: "https://mixkit.co/free-sound-effects/game/",
    licenseName: "Mixkit Sound Effects Free License",
    licenseUrl: "https://mixkit.co/license/modal/sfxFree/",
    licenseCheckedAt: "2026-10-11",
    attribution:
      "Sound provided by Mixkit. User-supplied file 2062; use within the game only, not redistribution with source files or as a sound library.",
  },
];
export function validSoundEffects(records: readonly SoundEffect[]): SoundEffect[] {
  const valid = new Set(validMusicTracks(records, "sfx"));
  const sounds = new Set<SoundName>();
  return records.filter((record) => {
    if (!valid.has(record)) return false;
    if (
      !["ui", "interaction", "player", "message", "level-up"].includes(record.sound) ||
      sounds.has(record.sound)
    ) {
      console.warn("Skipping invalid or duplicate sound mapping:", record.id);
      return false;
    }
    sounds.add(record.sound);
    return true;
  });
}
