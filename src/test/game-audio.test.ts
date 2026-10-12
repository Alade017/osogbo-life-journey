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
  it("plays original mission, reward and resource effects without fetching files", async () => {
    const audio = await import("../lib/game-audio");
    await audio.enableGameAudio();
    const oscillator = vi.spyOn(contexts[0]!, "createOscillator");
    for (const name of [
      "mission-complete",
      "reward",
      "xp-gain",
      "health-recharge",
      "energy-recharge",
    ] as const)
      audio.playGameSound(name);
    expect(oscillator).toHaveBeenCalledTimes(14);
    expect(fetch).not.toHaveBeenCalled();
    await audio.disableGameAudio();
    audio.playGameSound("mission-complete");
    expect(oscillator).toHaveBeenCalledTimes(14);
  });
  it("limits recharge cues during repeated recovery ticks", async () => {
    const audio = await import("../lib/game-audio");
    await audio.enableGameAudio();
    const oscillator = vi.spyOn(contexts[0]!, "createOscillator");
    const time = vi.spyOn(Date, "now").mockReturnValue(1000);
    audio.playGameSound("health-recharge");
    audio.playGameSound("health-recharge");
    expect(oscillator).toHaveBeenCalledTimes(3);
    time.mockReturnValue(11000);
    audio.playGameSound("health-recharge");
    expect(oscillator).toHaveBeenCalledTimes(6);
    await audio.disableGameAudio();
  });
  it("primes login silently and automatically starts once the character is ready", async () => {
    catalog.tracks = [record];
    const audio = await import("../lib/game-audio");
    audio.primeGameAudioForLogin();
    await settle();
    expect(contexts[0]!.gains[0]!.gain.value).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    audio.configureGameMusic("player");
    audio.startGameAudioSession();
    await settle();
    expect(audio.getMusicState().playing).toBe(true);
    expect(audio.getMusicState().soundEnabled).toBe(true);
    audio.configureGameMusic(null);
    await audio.disableGameAudio();
  });
  it("retries a blocked start on a trusted gesture and removes fallback after success", async () => {
    catalog.tracks = [record];
    const blocked = vi
      .spyOn(FakeContext.prototype, "resume")
      .mockRejectedValueOnce(new Error("blocked"));
    const listen = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    audio.startGameAudioSession();
    await settle();
    expect(audio.getMusicState().playing).toBe(false);
    const retry = listen.mock.calls.find((call) => call[0] === "pointerdown")![1] as EventListener;
    retry({ isTrusted: false } as Event);
    await settle();
    expect(blocked).toHaveBeenCalledTimes(1);
    retry({ isTrusted: true } as Event);
    await settle();
    expect(audio.getMusicState().playing).toBe(true);
    expect(remove).toHaveBeenCalledWith("pointerdown", retry);
    await audio.disableGameAudio();
    retry({ isTrusted: true } as Event);
    await settle();
    expect(audio.getMusicState().soundEnabled).toBe(false);
    audio.configureGameMusic(null);
  });
  it("does not reenable audio when a pending resume finishes after sound-off", async () => {
    catalog.tracks = [record];
    let finish!: () => void;
    vi.spyOn(FakeContext.prototype, "resume").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    const enabled = audio.enableGameAudio();
    await audio.disableGameAudio();
    finish();
    expect(await enabled).toBe(false);
    expect(audio.getMusicState().soundEnabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    audio.configureGameMusic(null);
  });
  it("previews the UI effect through the synthesized effects bus when enabled", async () => {
    const audio = await import("../lib/game-audio");
    await audio.enableGameAudio();
    const oscillator = vi.spyOn(contexts[0]!, "createOscillator");
    audio.playGameSound("ui");
    expect(oscillator).toHaveBeenCalledTimes(1);
    expect(oscillator.mock.results[0]!.value.start).toHaveBeenCalled();
    await audio.disableGameAudio();
    audio.playGameSound("ui");
    expect(oscillator).toHaveBeenCalledTimes(1);
  });
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
    vi.useRealTimers();
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
    expect(audio.getMusicState().status).toContain("Next track in five seconds");
    await audio.resumeGameMusic();
    expect(media).toHaveLength(2);
    expect(audio.getMusicState().playing).toBe(true);
    media[1]!.onended?.();
    await settle();
    expect(media).toHaveLength(2);
    expect(audio.getMusicState().playing).toBe(false);
    audio.configureGameMusic(null);
  });
  it("waits five seconds before automatically replaying and supports repeated cycles", async () => {
    catalog.tracks = [record];
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await settle();
    vi.useFakeTimers();
    media[0]!.onended?.();
    await vi.advanceTimersByTimeAsync(4999);
    expect(media).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(media).toHaveLength(2);
    expect(audio.getMusicState().playbackId).toBe(2);
    media[1]!.onended?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(media).toHaveLength(3);
    audio.configureGameMusic(null);
  });
  it.each(["pause", "off", "player"])("cancels restart on %s", async (mode) => {
    catalog.tracks = [record];
    const audio = await import("../lib/game-audio");
    audio.configureGameMusic("player");
    await audio.enableGameAudio();
    await settle();
    vi.useFakeTimers();
    media[0]!.onended?.();
    if (mode === "pause") audio.pauseGameMusic();
    else if (mode === "off") await audio.disableGameAudio();
    else audio.configureGameMusic(null);
    await vi.advanceTimersByTimeAsync(6000);
    expect(media).toHaveLength(1);
    audio.configureGameMusic(null);
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
