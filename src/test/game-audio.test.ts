import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { MusicTrack } from "../lib/music-tracks";

const record: MusicTrack = {
  id: "a",
  title: "Track",
  artist: "Artist",
  filePath: "/audio/music/a.mp3",
  duration: 10,
  sourceUrl: "https://example.com/source",
  uploader: "Uploader",
  licenseName: "License",
  licenseUrl: "https://example.com/license",
  licenseCheckedAt: "2026-10-11",
};
const catalog = vi.hoisted(() => ({ tracks: [] as MusicTrack[] }));
vi.mock("../lib/music-tracks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/music-tracks")>()),
  get musicTracks() {
    return catalog.tracks;
  },
}));
const contexts: FakeContext[] = [];
const media: FakeAudio[] = [];
function parameter() {
  return {
    value: 0,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}
class FakeContext {
  state = "suspended";
  currentTime = 0;
  sampleRate = 16;
  destination = {};
  gains: {
    gain: ReturnType<typeof parameter>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  constructor() {
    contexts.push(this);
  }
  createGain() {
    const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
    this.gains.push(node);
    return node;
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(32) };
  }
  createBufferSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
      buffer: null,
      loop: false,
    };
  }
  decodeAudioData = vi.fn(async () => ({ duration: 3 }));
  createBiquadFilter() {
    return { connect: vi.fn(), frequency: parameter(), type: "" };
  }
  createOscillator() {
    return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: parameter(), type: "" };
  }
  createMediaElementSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
}
class FakeAudio {
  duration = 10;
  currentTime = 0;
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  play = vi.fn(async () => {});
  pause = vi.fn();
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor() {
    media.push(this);
  }
}
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
describe("game music playback", () => {
  beforeEach(() => {
    vi.resetModules();
    catalog.tracks = [];
    contexts.length = 0;
    media.length = 0;
    localStorage.clear();
    vi.stubGlobal("AudioContext", FakeContext);
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["test"]),
        arrayBuffer: async () => new ArrayBuffer(4),
      })),
    );
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL() {
          return "blob:test";
        }
        static override revokeObjectURL() {}
      },
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("does not fetch or create media for an empty catalog", async () => {
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    expect(media).toHaveLength(0);
    expect(audio.getMusicState().playing).toBe(false);
  });
  it("rejects incomplete records before fetching", async () => {
    catalog.tracks = [{ ...record, licenseUrl: "" }];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await settle();
    expect(warn).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("starts only after enabling, routes volume, pauses, resumes and switches players", async () => {
    catalog.tracks = [record];
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.nextGameMusic();
    expect(fetch).not.toHaveBeenCalled();
    await audio.enableGameAudio();
    await settle();
    expect(audio.getMusicState().track?.title).toBe("Track");
    expect(audio.getMusicState().playing).toBe(true);
    audio.setGameAudioLevels({ master: 0, music: 0.4, effects: 0 });
    expect(contexts[0]!.gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.08);
    expect(contexts[0]!.gains[2]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.4, 0, 0.08);
    expect(contexts[0]!.gains[3]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.08);
    audio.pauseGameMusic();
    expect(media[0]!.pause).toHaveBeenCalled();
    await audio.resumeGameMusic();
    expect(audio.getMusicState().playing).toBe(true);
    await audio.disableGameAudio();
    expect(audio.isGameAudioActive()).toBe(false);
    expect(audio.getMusicState().playing).toBe(false);
    audio.configureGameMusic("other");
    expect(audio.getMusicState().track).toBeNull();
  });
  it("stops automatically and allows an explicit replay in a small library", async () => {
    catalog.tracks = [record];
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await settle();
    media[0]!.onended?.();
    await settle();
    expect(media).toHaveLength(1);
    expect(audio.getMusicState().status).toContain("No eligible tracks");
    await audio.resumeGameMusic();
    expect(media).toHaveLength(2);
    expect(audio.getMusicState().playing).toBe(true);
    media[1]!.onended?.();
    await settle();
    expect(media).toHaveLength(2);
    expect(audio.getMusicState().playing).toBe(false);
  });
  it("crossfades two sources and preserves the last five after reloading the manager", async () => {
    catalog.tracks = Array.from({ length: 6 }, (_, i) => ({ ...record, id: String(i) }));
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await settle();
    const first = audio.getMusicState().track!.id;
    await audio.nextGameMusic();
    expect(audio.getMusicState().track!.id).not.toBe(first);
    expect(contexts[0]!.gains[4]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1);
    expect(contexts[0]!.gains[5]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 1);
    const second = audio.getMusicState().track!.id;
    await audio.disableGameAudio();
    audio.configureGameMusic(null);
    vi.resetModules();
    const restored = await import("../lib/game-audio");
    restored.configureGameMusic("player");
    await restored.enableGameAudio();
    await settle();
    expect([first, second]).not.toContain(restored.getMusicState().track!.id);
    restored.configureGameMusic(null);
  });
  it("cancels pending playback when sound is turned off", async () => {
    catalog.tracks = [record];
    let resolve!: (value: { ok: boolean; blob: () => Promise<Blob> }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await audio.disableGameAudio();
    resolve({ ok: true, blob: async () => new Blob(["test"]) });
    await settle();
    expect(media).toHaveLength(0);
    expect(audio.getMusicState().playing).toBe(false);
  });
  it("loads and decodes a licensed effect once through the effects bus", async () => {
    const audio = await import("../lib/game-audio");
    audio.playGameSound("level-up");
    expect(fetch).not.toHaveBeenCalled();
    await audio.enableGameAudio();
    audio.playGameSound("level-up");
    await settle();
    audio.playGameSound("level-up");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(contexts[0]!.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(contexts[0]!.gains[4]!.connect).toHaveBeenCalledWith(contexts[0]!.gains[3]);
    await audio.disableGameAudio();
    audio.playGameSound("level-up");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
