# Local music

The user downloads audio themselves. No music is downloaded by development scripts.
Place approved files here and add complete records to `src/lib/music-tracks.ts`.
Each record must include id, title, artist, duration in seconds, local file path,
source URL, uploader, license name, license URL, and license check date (YYYY-MM-DD).
Record optional attribution too. A source URL and license check date are mandatory.
Missing records must be requested from the user before adding a track.
Use filenames containing letters, numbers, underscores or hyphens, with mp3/ogg/wav/m4a extensions.

Files are served publicly and can be downloaded by players. Playback requires a
user gesture. Audio is cached when loaded; this does not make the entire game
offline or guarantee persistence when browser storage is cleared. Six valid
tracks are required for continuous playback with strict last-five avoidance.

Run `node scripts/generate-audio-credits.mjs` after updating the manifest.
Tracks stop for five seconds before automatic playback resumes. Small libraries
may repeat a seeded cycle after eligible tracks are exhausted; larger libraries
retain last-five repeat avoidance. Pause and sound-off cancel pending restarts.
The supplied Loyalty Freak Music MP3 is CC0; Chosic is its download provenance,
and the matching Free Music Archive track listing supplies its license record.
