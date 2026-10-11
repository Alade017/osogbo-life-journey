export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  duration: number;
  sourceUrl: string;
  uploader: string;
  licenseName: string;
  licenseUrl: string;
  licenseCheckedAt: string;
  attribution?: string;
};

// Only user-supplied files with complete license records belong here.
export const musicTracks: MusicTrack[] = [];

export function validMusicTracks(records: readonly MusicTrack[]): MusicTrack[] {
  const ids = new Set<string>();
  return records.filter((track) => {
    const required = [track.id, track.title, track.artist, track.uploader, track.licenseName];
    const valid =
      required.every((value) => typeof value === "string" && value.trim()) &&
      /^\/audio\/music\/[a-zA-Z0-9_-]+\.(mp3|ogg|wav|m4a)$/.test(track.filePath) &&
      Number.isFinite(track.duration) &&
      track.duration > 0 &&
      [track.sourceUrl, track.licenseUrl].every((url) => {
        try {
          return new URL(url).protocol === "https:";
        } catch {
          return false;
        }
      }) &&
      /^\d{4}-\d{2}-\d{2}$/.test(track.licenseCheckedAt) &&
      Number.isFinite(Date.parse(track.licenseCheckedAt)) &&
      new Date(track.licenseCheckedAt).toISOString().slice(0, 10) === track.licenseCheckedAt &&
      !ids.has(track.id);
    if (!valid) console.warn("Skipping incomplete or invalid music record:", track.id);
    else ids.add(track.id);
    return valid;
  });
}

export function shuffledTracks(tracks: readonly MusicTrack[], seed: string): MusicTrack[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const result = [...tracks].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let index = result.length - 1; index > 0; index--) {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    const target = Math.floor((((value ^ (value >>> 14)) >>> 0) / 4294967296) * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

export function nextEligibleTrack(
  queue: readonly MusicTrack[],
  cursor: number,
  history: readonly string[],
) {
  for (let offset = 0; offset < queue.length; offset++) {
    const index = (cursor + offset) % queue.length;
    const track = queue[index]!;
    if (!history.slice(-5).includes(track.id)) return { track, cursor: (index + 1) % queue.length };
  }
  return null;
}
