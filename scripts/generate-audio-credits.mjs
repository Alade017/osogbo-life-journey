import { writeFileSync } from "node:fs";
import { musicTracks, validMusicTracks } from "../src/lib/music-tracks.ts";
import { soundEffects, validSoundEffects } from "../src/lib/sound-effects.ts";

const tracks = [...validMusicTracks(musicTracks), ...validSoundEffects(soundEffects)];
const credits = tracks.map(
  (track) =>
    `## ${track.title}\n\nArtist: ${track.artist}\nUploader: ${track.uploader}\nSource: ${track.sourceUrl}\nLicense: ${track.licenseName} (${track.licenseUrl})\nLicense checked: ${track.licenseCheckedAt}\nAttribution: ${track.attribution || "Not supplied"}\n`,
);
writeFileSync(
  new URL("../public/audio/CREDITS.md", import.meta.url),
  `# OSOGBO LIFE audio credits\n\n${credits.length ? credits.join("\n") : "No licensed recordings have been added.\n"}\nCity ambience and UI, interaction, player, message, mission completion, reward, XP gain, health recharge and energy recharge cues are original synthesized audio, with no third-party recordings.\n`,
);
