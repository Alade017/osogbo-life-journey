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
  current.music.gain.setTargetAtTime(levels.music * 0.025, now, 0.08);
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

  for (const frequency of [174.61, 220, 261.63]) {
    const oscillator = context.createOscillator();
    const tone = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    tone.gain.value = 0.18;
    oscillator.connect(tone);
    tone.connect(music);
    oscillator.start();
  }
  return current;
}

export async function enableGameAudio(levels = readGameAudioLevels()): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (!graph) graph = createAudioGraph(levels);
    if (!graph) return false;
    applyLevels(graph, levels);
    await graph.context.resume();
    return graph.context.state === "running";
  } catch {
    return false;
  }
}

export async function disableGameAudio() {
  if (!graph) return;
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
