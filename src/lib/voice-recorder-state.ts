export const VOICE_HOLD_THRESHOLD_MS = 150;
export const VOICE_CANCEL_RATIO = 0.3;
export const VOICE_MIN_DURATION_MS = 1_000;
export const VOICE_WARNING_MS = 55_000;
export const VOICE_MAX_DURATION_MS = 60_000;
export const VOICE_CLIENT_TARGET_BYTES = 150 * 1024;
export const VOICE_SERVER_MAX_BYTES = 500 * 1024;

export type VoiceInterruption =
  | "backgrounded"
  | "focus_lost"
  | "incoming_call"
  | "device_locked"
  | "match_started"
  | "forced_disconnect";

export type VoiceRecorderState = {
  phase: "idle" | "pressing" | "recording" | "uploading" | "failed" | "locked";
  pressedAt: number | null;
  startedAt: number | null;
  startX: number;
  currentX: number;
  composerWidth: number;
  elapsedMs: number;
  warning: boolean;
  cancelReady: boolean;
  hint: string | null;
};

export type VoiceRecorderEvent =
  | { type: "press"; at: number; x: number; width: number }
  | { type: "threshold"; at: number }
  | { type: "move"; x: number }
  | { type: "tick"; at: number }
  | { type: "release"; at: number }
  | { type: "interrupt"; reason: VoiceInterruption }
  | { type: "upload_started" }
  | { type: "upload_succeeded" }
  | { type: "upload_failed" }
  | { type: "reset" };

export const initialVoiceRecorderState: VoiceRecorderState = {
  phase: "idle",
  pressedAt: null,
  startedAt: null,
  startX: 0,
  currentX: 0,
  composerWidth: 1,
  elapsedMs: 0,
  warning: false,
  cancelReady: false,
  hint: null,
};

const interruptionMessage: Record<VoiceInterruption, string> = {
  backgrounded: "Recording discarded because the app went into the background.",
  focus_lost: "Recording discarded because the tab lost focus.",
  incoming_call: "Recording discarded because a call started.",
  device_locked: "Recording discarded because the device was locked.",
  match_started: "Recording discarded because live play started.",
  forced_disconnect: "Recording discarded. Reconnect before recording again.",
};

export function voiceRecorderReducer(
  state: VoiceRecorderState,
  event: VoiceRecorderEvent,
): VoiceRecorderState {
  switch (event.type) {
    case "press":
      if (state.phase !== "idle") return state;
      return {
        ...initialVoiceRecorderState,
        phase: "pressing",
        pressedAt: event.at,
        startX: event.x,
        currentX: event.x,
        composerWidth: Math.max(1, event.width),
      };
    case "threshold":
      if (
        state.phase !== "pressing" ||
        state.pressedAt === null ||
        event.at - state.pressedAt < VOICE_HOLD_THRESHOLD_MS
      )
        return state;
      return { ...state, phase: "recording", startedAt: event.at, elapsedMs: 0 };
    case "move": {
      if (state.phase !== "pressing" && state.phase !== "recording") return state;
      const cancelReady = state.startX - event.x >= state.composerWidth * VOICE_CANCEL_RATIO;
      return { ...state, currentX: event.x, cancelReady };
    }
    case "tick": {
      if (state.phase !== "recording" || state.startedAt === null) return state;
      const elapsedMs = Math.max(0, event.at - state.startedAt);
      if (elapsedMs >= VOICE_MAX_DURATION_MS)
        return { ...state, phase: "locked", elapsedMs: VOICE_MAX_DURATION_MS, warning: true };
      return { ...state, elapsedMs, warning: elapsedMs >= VOICE_WARNING_MS };
    }
    case "release":
      if (state.phase === "pressing")
        return { ...initialVoiceRecorderState, hint: "Hold to record" };
      if (state.phase !== "recording" && state.phase !== "locked") return state;
      if (state.cancelReady) return { ...initialVoiceRecorderState, hint: "Voice note cancelled." };
      if (state.elapsedMs < VOICE_MIN_DURATION_MS)
        return { ...initialVoiceRecorderState, hint: "Hold a little longer to send." };
      return { ...state, phase: "uploading" };
    case "interrupt":
      if (state.phase !== "pressing" && state.phase !== "recording" && state.phase !== "locked")
        return state;
      return { ...initialVoiceRecorderState, hint: interruptionMessage[event.reason] };
    case "upload_started":
      return state.phase === "recording" || state.phase === "locked"
        ? { ...state, phase: "uploading" }
        : state;
    case "upload_succeeded":
      return { ...initialVoiceRecorderState, hint: "Voice note sent." };
    case "upload_failed":
      return { ...state, phase: "failed", hint: "Failed. Tap to retry." };
    case "reset":
      return initialVoiceRecorderState;
  }
}
