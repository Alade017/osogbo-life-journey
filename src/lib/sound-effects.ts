import { type MusicTrack, validMusicTracks } from "./music-tracks.ts";

export type SoundName =
  | "ui"
  | "interaction"
  | "player"
  | "message"
  | "notification"
  | "level-up"
  | "mission-complete"
  | "reward"
  | "xp-gain"
  | "health-recharge"
  | "energy-recharge";
export type SoundEffect = MusicTrack & { sound: SoundName };
export const soundEffects: SoundEffect[] = [
  {
    id: "kenney-click_001",
    sound: "ui",
    title: "Interface Sounds - click_001",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-click_001.ogg",
    duration: 0.10002267573696146,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-select_002",
    sound: "interaction",
    title: "Interface Sounds - select_002",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-select_002.ogg",
    duration: 0.04328798185941043,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-open_001",
    sound: "player",
    title: "Interface Sounds - open_001",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-open_001.ogg",
    duration: 0.14777777777777779,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-confirmation_001",
    sound: "message",
    title: "Interface Sounds - confirmation_001",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-confirmation_001.ogg",
    duration: 0.28984126984126984,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-glass_001",
    sound: "notification",
    title: "Interface Sounds - glass_001",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-glass_001.ogg",
    duration: 0.27843537414965985,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-confirmation_004",
    sound: "level-up",
    title: "Interface Sounds - confirmation_004",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-confirmation_004.ogg",
    duration: 0.4904081632653061,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-confirmation_003",
    sound: "mission-complete",
    title: "Interface Sounds - confirmation_003",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-confirmation_003.ogg",
    duration: 0.3220181405895692,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-pluck_001",
    sound: "reward",
    title: "Interface Sounds - pluck_001",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-pluck_001.ogg",
    duration: 0.10242630385487528,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-tick_001",
    sound: "xp-gain",
    title: "Interface Sounds - tick_001",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-tick_001.ogg",
    duration: 0.023219954648526078,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-confirmation_001-health-recharge",
    sound: "health-recharge",
    title: "Interface Sounds - confirmation_001 (health recovery)",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-confirmation_001.ogg",
    duration: 0.28984126984126984,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
  {
    id: "kenney-open_001-energy-recharge",
    sound: "energy-recharge",
    title: "Interface Sounds - open_001 (energy recovery)",
    artist: "Kenney",
    uploader: "Kenney",
    filePath: "/audio/sfx/kenney-open_001.ogg",
    duration: 0.14777777777777779,
    sourceUrl: "https://kenney.nl/assets/interface-sounds",
    licenseName: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseCheckedAt: "2026-10-18",
  },
];
export function validSoundEffects(records: readonly SoundEffect[]): SoundEffect[] {
  const valid = new Set(validMusicTracks(records, "sfx"));
  const sounds = new Set<SoundName>();
  return records.filter((record) => {
    if (!valid.has(record)) return false;
    if (
      ![
        "ui",
        "interaction",
        "player",
        "message",
        "notification",
        "level-up",
        "mission-complete",
        "reward",
        "xp-gain",
        "health-recharge",
        "energy-recharge",
      ].includes(record.sound) ||
      sounds.has(record.sound)
    ) {
      console.warn("Skipping invalid or duplicate sound mapping:", record.id);
      return false;
    }
    sounds.add(record.sound);
    return true;
  });
}
