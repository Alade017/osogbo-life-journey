import {
  musicTracks,
  validMusicTracks,
  shuffledTracks,
  nextEligibleTrack,
  type MusicTrack,
} from "./music-tracks";
type AudioLevels = { master: number; music: number; effects: number };
type SoundName = "ui" | "interaction" | "player" | "message";

type AudioGraph = {
  context: AudioContext;
  master: GainNode;
  ambience: GainNode;
  music: GainNode;
  effects: GainNode;
};

const STORAGE_KEY = "osogbo-world-audio-v1";
const DEFAULT_LEVELS: AudioLevels = { master: 0.55, music: 0.2, effects: 0.45 };
let graph: AudioGraph | null = null;

export const playableMusicTracks = validMusicTracks(musicTracks);
type MusicState = { track: MusicTrack | null; status: string; playing: boolean };
const emptyMusicState: MusicState = {
  track: null,
  status: "No licensed music added yet.",
  playing: false,
};
let musicState = emptyMusicState;
const musicListeners = new Set<() => void>();
export const getMusicState = () => musicState;
export const getServerMusicState = () => emptyMusicState;
export function subscribeMusic(listener: () => void) {
  musicListeners.add(listener);
  return () => {
    musicListeners.delete(listener);
  };
}
function publishMusic(patch: Partial<MusicState>) {
  musicState = { ...musicState, ...patch };
  musicListeners.forEach((listener) => listener());
}
let playerId: string | null = null;
let queue: MusicTrack[] = [];
let cursor = 0;
let history: string[] = [];
let revision = 0;
let loading = false;
type Deck = {
  audio: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
  url: string;
};
let deck: Deck | null = null;
const decks = new Set<Deck>();
function disposeDeck(value: Deck) {
  value.audio.pause();
  value.audio.removeAttribute("src");
  value.audio.load();
  value.source.disconnect();
  value.gain.disconnect();
  URL.revokeObjectURL(value.url);
  decks.delete(value);
}
function saveQueue() {
  try {
    localStorage.setItem(
      `osogbo-music-v1:${playerId}`,
      JSON.stringify({ cursor, history, catalog: queue.map((track) => track.id) }),
    );
  } catch {
    /* Session still works without storage. */
  }
}
export function configureGameMusic(id: string | null) {
  if (id === playerId) return;
  pauseGameMusic();
  for (const value of [...decks]) disposeDeck(value);
  deck = null;
  playerId = id;
  queue = id ? shuffledTracks(playableMusicTracks, id) : [];
  cursor = 0;
  history = [];
  try {
    const saved = JSON.parse(localStorage.getItem(`osogbo-music-v1:${id}`) ?? "null");
    if (saved && Array.isArray(saved.history))
      history = saved.history.filter((item: unknown) => typeof item === "string").slice(-5);
    if (
      saved &&
      JSON.stringify(saved.catalog) === JSON.stringify(queue.map((track) => track.id)) &&
      Number.isInteger(saved.cursor) &&
      saved.cursor >= 0 &&
      saved.cursor < queue.length
    )
      cursor = saved.cursor;
  } catch {
    /* Ignore corrupt or unavailable storage. */
  }
  publishMusic({
    ...emptyMusicState,
    status: queue.length ? "Enable sound to start music." : emptyMusicState.status,
  });
}

async function localAudioUrl(track: MusicTrack): Promise<string> {
  const cache =
    typeof caches !== "undefined" ? await caches.open("osogbo-music-v1").catch(() => null) : null;
  let response = await cache?.match(track.filePath).catch(() => undefined);
  if (!response) {
    response = await fetch(track.filePath);
    if (!response.ok) throw new Error("Audio file unavailable");
    await cache?.put(track.filePath, response.clone()).catch(() => {});
  }
  return URL.createObjectURL(await response.blob());
}

export function pauseGameMusic() {
  revision++;
  loading = false;
  for (const value of decks) {
    value.audio.pause();
    value.gain.gain.cancelScheduledValues(0);
    value.gain.gain.value = value === deck ? 1 : 0;
  }
  publishMusic({
    playing: false,
    status: playableMusicTracks.length ? "Music paused." : emptyMusicState.status,
  });
}

export async function resumeGameMusic() {
  if (!isGameAudioActive() || !playerId || loading) return;
  if (!deck) {
    await nextGameMusic();
    return;
  }
  const token = revision;
  try {
    await deck.audio.play();
    if (token !== revision) {
      deck?.audio.pause();
      return;
    }
    publishMusic({ playing: true, status: "Playing" });
  } catch {
    publishMusic({ playing: false, status: "Press resume to allow music playback." });
  }
}

export async function nextGameMusic() {
  if (!graph || !isGameAudioActive() || !playerId || loading || !queue.length) return;
  loading = true;
  const token = ++revision;
  const failed: string[] = [];
  try {
    for (let attempt = 0; attempt < queue.length; attempt++) {
      const next = nextEligibleTrack(queue, cursor, history);
      if (!next) break;
      cursor = next.cursor;
      if (failed.includes(next.track.id)) continue;
      let candidate: Deck | null = null;
      try {
        publishMusic({ status: "Loading music…" });
        const url = await localAudioUrl(next.track);
        if (token !== revision) {
          URL.revokeObjectURL(url);
          return;
        }
        const audio = new Audio(url);
        const gain = graph.context.createGain();
        gain.gain.value = 0;
        const source = graph.context.createMediaElementSource(audio);
        source.connect(gain);
        gain.connect(graph.music);
        candidate = { audio, gain, source, url };
        decks.add(candidate);
        await audio.play();
        if (token !== revision) {
          disposeDeck(candidate);
          return;
        }
        const previous = deck;
        deck = candidate;
        cursor = next.cursor;
        history = [...history, next.track.id].slice(-5);
        saveQueue();
        const now = graph.context.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + 1);
        if (previous) {
          previous.gain.gain.cancelScheduledValues(now);
          previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
          previous.gain.gain.linearRampToValueAtTime(0, now + 1);
          setTimeout(() => {
            if (decks.has(previous)) disposeDeck(previous);
          }, 1100);
        }
        audio.onended = () => {
          if (deck?.audio === audio) {
            disposeDeck(deck);
            deck = null;
            publishMusic({ playing: false });
            void nextGameMusic();
          }
        };
        audio.ontimeupdate = () => {
          if (
            deck?.audio === audio &&
            Number.isFinite(audio.duration) &&
            audio.duration - audio.currentTime <= 1 &&
            nextEligibleTrack(queue, cursor, history)
          )
            void nextGameMusic();
        };
        publishMusic({ track: next.track, playing: true, status: "Playing" });
        return;
      } catch {
        if (candidate) disposeDeck(candidate);
        if (token !== revision) return;
        failed.push(next.track.id);
        console.warn("Could not play local music:", next.track.id);
      }
    }
    pauseGameMusic();
    for (const value of [...decks]) disposeDeck(value);
    deck = null;
    publishMusic({
      status:
        "No eligible tracks. At least six tracks are needed for continuous playback without repeating the last five.",
    });
  } finally {
    if (token === revision) loading = false;
  }
}

export function readGameAudioLevels(): AudioLevels {
  if (typeof window === "undefined") return DEFAULT_LEVELS;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_LEVELS;
    const input = value as Record<string, unknown>;
    const level = (key: keyof AudioLevels) =>
      typeof input[key] === "number" && Number.isFinite(input[key])
        ? Math.max(0, Math.min(1, input[key] as number))
        : DEFAULT_LEVELS[key];
    return { master: level("master"), music: level("music"), effects: level("effects") };
  } catch {
    return DEFAULT_LEVELS;
  }
}

function saveLevels(levels: AudioLevels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // Keep audio controls usable for this session when storage is unavailable.
  }
}

function applyLevels(current: AudioGraph, levels: AudioLevels) {
  const now = current.context.currentTime;
  current.master.gain.setTargetAtTime(levels.master, now, 0.08);
  current.music.gain.setTargetAtTime(levels.music, now, 0.08);
  current.effects.gain.setTargetAtTime(levels.effects * 0.08, now, 0.08);
}

function createAudioGraph(levels: AudioLevels): AudioGraph | null {
  const AudioContextType = window.AudioContext;
  if (!AudioContextType) return null;
  const context = new AudioContextType();
  const master = context.createGain();
  const ambience = context.createGain();
  const music = context.createGain();
  const effects = context.createGain();
  const current = { context, master, ambience, music, effects };
  applyLevels(current, levels);
  ambience.gain.value = 0.035;
  ambience.connect(master);
  music.connect(master);
  effects.connect(master);
  master.connect(context.destination);

  // Original synthesized ambience and tones; no recordings or remote audio assets.
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index++)
    channel[index] = (Math.random() * 2 - 1) * 0.12;
  const noise = context.createBufferSource();
  const lowPass = context.createBiquadFilter();
  noise.buffer = buffer;
  noise.loop = true;
  lowPass.type = "lowpass";
  lowPass.frequency.value = 460;
  noise.connect(lowPass);
  lowPass.connect(ambience);
  noise.start();

  return current;
}

export async function enableGameAudio(levels = readGameAudioLevels()): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (!graph) graph = createAudioGraph(levels);
    if (!graph) return false;
    applyLevels(graph, levels);
    await graph.context.resume();
    if (graph.context.state === "running") void resumeGameMusic();
    return graph.context.state === "running";
  } catch {
    return false;
  }
}

export async function disableGameAudio() {
  pauseGameMusic();
  if (!graph) return;
  graph.master.gain.cancelScheduledValues(graph.context.currentTime);
  graph.master.gain.value = 0;
  try {
    await graph.context.suspend();
  } catch {
    // The game continues without audio if the browser refuses to suspend it.
  }
}

export function isGameAudioActive() {
  return graph?.context.state === "running";
}

export function setGameAudioLevels(levels: AudioLevels) {
  saveLevels(levels);
  if (graph) applyLevels(graph, levels);
}

export function playGameSound(name: SoundName) {
  const current = graph;
  if (!current || current.context.state !== "running") return;
  const patterns: Record<SoundName, number[]> = {
    ui: [660],
    interaction: [523.25, 659.25],
    player: [440, 554.37, 659.25],
    message: [784, 659.25],
  };
  const now = current.context.currentTime;
  for (const [index, frequency] of patterns[name].entries()) {
    const oscillator = current.context.createOscillator();
    const envelope = current.context.createGain();
    const start = now + index * 0.075;
    oscillator.type = name === "message" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.18, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    oscillator.connect(envelope);
    envelope.connect(current.effects);
    oscillator.start(start);
    oscillator.stop(start + 0.13);
  }
}
