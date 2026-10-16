import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Mic, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  initialVoiceRecorderState,
  voiceRecorderReducer,
  VOICE_HOLD_THRESHOLD_MS,
  VOICE_MAX_DURATION_MS,
  VOICE_MIN_DURATION_MS,
} from "@/lib/voice-recorder-state";
import {
  getVoiceNoteUrl,
  prepareVoiceUpload,
  reencodeVoiceNote,
  supportedVoiceMimeType,
  uploadVoiceNote,
} from "@/lib/voice-notes";

export function VoiceNoteRecorder({
  threadId,
  disabled,
  livePlay,
  onSent,
}: {
  threadId: string;
  disabled?: boolean;
  livePlay?: boolean;
  onSent: () => void;
}) {
  const [state, dispatch] = useReducer(voiceRecorderReducer, initialVoiceRecorderState);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const held = useRef(false);
  const startedAt = useRef(0);
  const stopAction = useRef<"send" | "discard">("discard");
  const cancelReady = useRef(false);
  const retry = useRef<{ blob: Blob; durationMs: number; requestId: string } | null>(null);
  const mimeType = supportedVoiceMimeType();

  const cleanupStream = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  const sendBlob = async (
    blob: Blob,
    durationMs: number,
    requestId: string = crypto.randomUUID(),
  ) => {
    dispatch({ type: "upload_started" });
    try {
      const prepared = await prepareVoiceUpload(blob, reencodeVoiceNote);
      retry.current = { blob: prepared, durationMs, requestId };
      await uploadVoiceNote({ threadId, blob: prepared, durationMs, requestId });
      retry.current = null;
      dispatch({ type: "upload_succeeded" });
      onSent();
    } catch (error) {
      dispatch({ type: "upload_failed" });
      toast.error(error instanceof Error ? error.message : "Voice note failed to send.");
    }
  };

  const finish = (action: "send" | "discard") => {
    const current = recorder.current;
    stopAction.current = action;
    if (current && current.state !== "inactive") current.stop();
    else cleanupStream();
  };

  const startRecording = async () => {
    if (!held.current || !mimeType || disabled || livePlay) return;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      if (!held.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      chunks.current = [];
      dispatch({ type: "threshold", at: performance.now() });
      const next = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 16_000 });
      recorder.current = next;
      startedAt.current = performance.now();
      next.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.current.push(event.data);
        setWaveform((values) => [...values.slice(-20), Math.min(1, event.data.size / 4_000)]);
      };
      next.onstop = () => {
        const durationMs = Math.min(VOICE_MAX_DURATION_MS, performance.now() - startedAt.current);
        const blob = new Blob(chunks.current, { type: mimeType });
        recorder.current = null;
        cleanupStream();
        if (stopAction.current === "send" && durationMs >= VOICE_MIN_DURATION_MS)
          void sendBlob(blob, Math.round(durationMs));
      };
      next.start(100);
      navigator.vibrate?.(25);
    } catch {
      dispatch({ type: "reset" });
      setPermissionError(
        "Microphone permission was not granted. You can still send text messages.",
      );
    }
  };

  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || livePlay) return;
    held.current = true;
    cancelReady.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const width = event.currentTarget.closest("form")?.getBoundingClientRect().width ?? 1;
    dispatch({ type: "press", at: performance.now(), x: event.clientX, width });
    window.setTimeout(() => {
      if (held.current) void startRecording();
    }, VOICE_HOLD_THRESHOLD_MS);
  };

  const release = () => {
    const wasRecording = recorder.current?.state === "recording";
    held.current = false;
    const durationMs = startedAt.current ? performance.now() - startedAt.current : 0;
    const cancel = cancelReady.current;
    dispatch({ type: "release", at: performance.now() });
    if (wasRecording) finish(cancel || durationMs < VOICE_MIN_DURATION_MS ? "discard" : "send");
  };

  useEffect(() => {
    if (state.phase !== "recording") return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", at: now });
      const elapsed = now - startedAt.current;
      if (elapsed >= 55_000 && elapsed < 55_200) navigator.vibrate?.([30, 40, 30]);
      if (elapsed >= VOICE_MAX_DURATION_MS) finish("send");
    }, 100);
    return () => window.clearInterval(timer);
    // Recorder and stream instances are intentionally owned by refs for this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  useEffect(() => {
    const interrupt = (
      reason:
        | "backgrounded"
        | "focus_lost"
        | "incoming_call"
        | "device_locked"
        | "match_started"
        | "forced_disconnect",
    ) => {
      if (recorder.current?.state === "recording") finish("discard");
      dispatch({ type: "interrupt", reason });
    };
    const visibility = () => {
      if (document.hidden) interrupt("backgrounded");
    };
    const blur = () => interrupt("focus_lost");
    const pageHide = () => interrupt("device_locked");
    const call = () => interrupt("incoming_call");
    const match = () => interrupt("match_started");
    const disconnect = () => interrupt("forced_disconnect");
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("offline", disconnect);
    window.addEventListener("osun-life-incoming-call", call);
    window.addEventListener("osun-life-match-start", match);
    window.addEventListener("osun-life-forced-disconnect", disconnect);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("offline", disconnect);
      window.removeEventListener("osun-life-incoming-call", call);
      window.removeEventListener("osun-life-match-start", match);
      window.removeEventListener("osun-life-forced-disconnect", disconnect);
      finish("discard");
    };
    // Global interruption listeners stay stable for the lifetime of this recorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (livePlay && recorder.current?.state === "recording") {
      finish("discard");
      dispatch({ type: "interrupt", reason: "match_started" });
    }
    // The current recorder is read from its ref when live play changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePlay]);

  useEffect(() => {
    if (!state.hint) return;
    const timer = window.setTimeout(() => dispatch({ type: "reset" }), 2_000);
    return () => window.clearTimeout(timer);
  }, [state.hint]);

  if (!mimeType) return null;
  return (
    <div className="voice-note-recorder">
      {state.phase === "recording" || state.phase === "locked" ? (
        <div className={`voice-recording-strip ${state.cancelReady ? "is-cancelling" : ""}`}>
          <span>{Math.floor(state.elapsedMs / 1000)}s</span>
          <span className="voice-waveform" aria-label="Recording waveform">
            {waveform.map((height, index) => (
              <i key={index} style={{ height: `${Math.max(4, height * 22)}px` }} />
            ))}
          </span>
          <span>{state.cancelReady ? "Release to cancel" : "Slide left to cancel"}</span>
        </div>
      ) : null}
      <button
        type="button"
        className="voice-record-button"
        aria-label="Hold to record a voice note"
        title={livePlay ? "Voice notes are available between sessions." : "Hold to record"}
        disabled={disabled || livePlay || state.phase === "uploading"}
        onPointerDown={press}
        onPointerMove={(event) => {
          cancelReady.current = state.startX - event.clientX >= state.composerWidth * 0.3;
          dispatch({ type: "move", x: event.clientX });
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <Mic aria-hidden="true" />
      </button>
      {(state.hint || permissionError) && (
        <span className="voice-note-hint" role="status">
          {permissionError ?? state.hint}
        </span>
      )}
      {state.phase === "failed" && retry.current && (
        <button
          type="button"
          className="voice-retry"
          onClick={() =>
            void sendBlob(retry.current!.blob, retry.current!.durationMs, retry.current!.requestId)
          }
        >
          <RotateCcw aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}

let activeAudio: HTMLAudioElement | null = null;

export function VoiceNotePlayer({
  messageId,
  durationMs,
}: {
  messageId: string;
  durationMs: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);

  const toggle = async () => {
    const element = audio.current;
    if (!element) return;
    if (playing) {
      element.pause();
      return;
    }
    setLoading(true);
    try {
      if (!element.src) element.src = await getVoiceNoteUrl(messageId);
      if (activeAudio && activeAudio !== element) activeAudio.pause();
      activeAudio = element;
      element.playbackRate = speed;
      await element.play();
    } catch {
      toast.error("Voice note could not be played.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(
    () => () => {
      if (activeAudio === audio.current) activeAudio = null;
      audio.current?.pause();
    },
    [],
  );

  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return (
    <span className="voice-note-player">
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <input
        type="range"
        min="0"
        max={seconds}
        step="0.1"
        value={Math.min(current, seconds)}
        aria-label="Voice note position"
        onChange={(event) => {
          const value = Number(event.target.value);
          setCurrent(value);
          if (audio.current) audio.current.currentTime = value;
        }}
      />
      <small>{loading ? "Loading" : `${Math.floor(current)} / ${seconds}s`}</small>
      <button
        type="button"
        aria-label={`Playback speed ${speed} times`}
        onClick={() => {
          const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
          setSpeed(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
      >
        {speed}×
      </button>
    </span>
  );
}
