import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type AudioGraph = {
  context: AudioContext;
  master: GainNode;
  ambience: GainNode;
  music: GainNode;
  effects: GainNode;
};

const STORAGE_KEY = "osogbo-world-audio-v1";
type Levels = { master: number; music: number; effects: number };
const DEFAULT_LEVELS: Levels = { master: 0.55, music: 0.2, effects: 0.45 };

function readLevels(): Levels {
  if (typeof window === "undefined") return DEFAULT_LEVELS;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_LEVELS;
    const input = value as Record<string, unknown>;
    const level = (key: keyof Levels) =>
      typeof input[key] === "number" && Number.isFinite(input[key])
        ? Math.max(0, Math.min(1, input[key] as number))
        : DEFAULT_LEVELS[key];
    return { master: level("master"), music: level("music"), effects: level("effects") };
  } catch {
    return DEFAULT_LEVELS;
  }
}

function createAudioGraph(levels: Levels): AudioGraph | null {
  const AudioContextType = window.AudioContext;
  if (!AudioContextType) return null;
  const context = new AudioContextType();
  const master = context.createGain();
  const ambience = context.createGain();
  const music = context.createGain();
  const effects = context.createGain();
  master.gain.value = levels.master;
  ambience.gain.value = 0.035;
  music.gain.value = levels.music * 0.025;
  effects.gain.value = levels.effects * 0.08;
  ambience.connect(master);
  music.connect(master);
  effects.connect(master);
  master.connect(context.destination);

  // A quiet synthesized soundscape avoids remote audio dependencies or unlicensed recordings.
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
  return { context, master, ambience, music, effects };
}

export function WorldAudioSettings({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const [levels, setLevels] = useState(readLevels);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const graph = useRef<AudioGraph | null>(null);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    } catch {
      // Audio preferences remain usable for this session if storage is disabled.
    }
  }, [levels]);

  useEffect(
    () => () => {
      void graph.current?.context.close();
      graph.current = null;
    },
    [],
  );

  async function enableAudio() {
    try {
      if (!graph.current) graph.current = createAudioGraph(levelsRef.current);
      if (!graph.current) {
        setAudioUnavailable(true);
        return;
      }
      await graph.current.context.resume();
      onEnabledChange(true);
      setAudioActive(true);
      setAudioUnavailable(false);
    } catch {
      setAudioUnavailable(true);
    }
  }

  async function disableAudio() {
    onEnabledChange(false);
    setAudioActive(false);
    await graph.current?.context.suspend();
  }

  function setLevel(key: keyof Levels, value: number) {
    const next = { ...levelsRef.current, [key]: value };
    setLevels(next);
    const current = graph.current;
    if (!current) return;
    if (key === "master")
      current.master.gain.setTargetAtTime(value, current.context.currentTime, 0.08);
    if (key === "music")
      current.music.gain.setTargetAtTime(value * 0.025, current.context.currentTime, 0.08);
    if (key === "effects")
      current.effects.gain.setTargetAtTime(value * 0.08, current.context.currentTime, 0.08);
  }

  function previewEffect() {
    const current = graph.current;
    if (!current || !audioActive) return;
    const oscillator = current.context.createOscillator();
    const envelope = current.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    envelope.gain.setValueAtTime(0.0001, current.context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.18, current.context.currentTime + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, current.context.currentTime + 0.16);
    oscillator.connect(envelope);
    envelope.connect(current.effects);
    oscillator.start();
    oscillator.stop(current.context.currentTime + 0.17);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optional original synthesized city ambience and soft tones. Audio starts only after you
        enable it.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {audioActive ? (
          <Button variant="outline" onClick={() => void disableAudio()}>
            Turn sound off
          </Button>
        ) : (
          <Button onClick={() => void enableAudio()}>Enable sound</Button>
        )}
        {!audioActive && enabled && (
          <span className="text-xs text-muted-foreground">
            Saved preference · start audio when ready
          </span>
        )}
        {audioUnavailable && (
          <span role="status" className="text-sm text-muted-foreground">
            Audio is unavailable in this browser; the game still works normally.
          </span>
        )}
      </div>
      <Button variant="outline" disabled={!audioActive} onClick={previewEffect}>
        Preview UI sound
      </Button>
      {(["master", "music", "effects"] as const).map((key) => (
        <label key={key} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="capitalize">
            {key === "effects" ? "Effects" : key === "master" ? "Master" : "Music"}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={levels[key]}
            aria-label={`${key} volume`}
            onChange={(event) => setLevel(key, Number(event.target.value))}
          />
          <span className="tabular-nums">{Math.round(levels[key] * 100)}%</span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        No external weather or audio service is required. The music control adjusts the included
        soft ambient tone layer.
      </p>
    </div>
  );
}
