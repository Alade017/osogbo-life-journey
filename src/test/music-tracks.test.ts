import { describe, expect, it, vi } from "vitest";
import {
  type MusicTrack,
  validMusicTracks,
  shuffledTracks,
  nextEligibleTrack,
} from "../lib/music-tracks";

const record: MusicTrack = {
  id: "a",
  title: "Test",
  artist: "Test",
  filePath: "/audio/music/test.mp3",
  duration: 10,
  sourceUrl: "https://example.com/source",
  uploader: "Test",
  licenseName: "Test license",
  licenseUrl: "https://example.com/license",
  licenseCheckedAt: "2026-10-11",
};
const catalog = Array.from({ length: 8 }, (_, i) => ({ ...record, id: String(i) }));
describe("local music catalog", () => {
  it("supports an empty catalog", () => {
    expect(validMusicTracks([])).toEqual([]);
    expect(shuffledTracks([], "player")).toEqual([]);
    expect(nextEligibleTrack([], 0, [])).toBeNull();
  });
  it("accepts complete records", () => expect(validMusicTracks([record])).toEqual([record]));
  it("rejects incomplete records, invalid dates, paths and duplicate ids with warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      validMusicTracks([
        { ...record, sourceUrl: "" },
        { ...record, licenseUrl: "" },
        { ...record, licenseCheckedAt: "2026-02-30" },
        { ...record, filePath: "/audio/music/../bad.mp3" },
        record,
        record,
      ]),
    ).toEqual([record]);
    expect(warn).toHaveBeenCalledTimes(5);
    warn.mockRestore();
  });
  it("shuffles deterministically without changing the catalog", () => {
    const before = [...catalog];
    expect(shuffledTracks(catalog, "a")).toEqual(shuffledTracks([...catalog].reverse(), "a"));
    expect(shuffledTracks(catalog, "a")).not.toEqual(shuffledTracks(catalog, "b"));
    expect(catalog).toEqual(before);
    expect(new Set(shuffledTracks(catalog, "a").map((t) => t.id)).size).toBe(8);
  });
  it("avoids the previous five across cycles and persisted sessions", () => {
    const queue = shuffledTracks(catalog, "character");
    let cursor = 0;
    let history: string[] = [];
    for (let i = 0; i < 50; i++) {
      const next = nextEligibleTrack(queue, cursor, history)!;
      expect(history).not.toContain(next.track.id);
      cursor = next.cursor;
      history = JSON.parse(JSON.stringify([...history, next.track.id].slice(-5)));
    }
  });
  it("stops rather than violating repeat avoidance in small libraries", () => {
    for (let count = 1; count <= 5; count++) {
      const tracks = catalog.slice(0, count);
      expect(
        nextEligibleTrack(
          tracks,
          0,
          tracks.map((t) => t.id),
        ),
      ).toBeNull();
    }
  });
});
