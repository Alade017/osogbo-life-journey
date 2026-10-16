import { describe, expect, it } from "vitest";
import {
  initialVoiceRecorderState,
  voiceRecorderReducer,
  VOICE_CLIENT_TARGET_BYTES,
  VOICE_SERVER_MAX_BYTES,
} from "@/lib/voice-recorder-state";

const pressed = voiceRecorderReducer(initialVoiceRecorderState, {
  type: "press",
  at: 1_000,
  x: 300,
  width: 300,
});

describe("voice recording state", () => {
  it("treats 149 ms as a tap and 150 ms as a hold", () => {
    expect(voiceRecorderReducer(pressed, { type: "threshold", at: 1_149 }).phase).toBe("pressing");
    expect(voiceRecorderReducer(pressed, { type: "release", at: 1_149 }).hint).toBe(
      "Hold to record",
    );
    expect(voiceRecorderReducer(pressed, { type: "threshold", at: 1_150 }).phase).toBe("recording");
  });

  it("cancels at exactly 30 percent of composer width", () => {
    const recording = voiceRecorderReducer(pressed, { type: "threshold", at: 1_150 });
    const moved = voiceRecorderReducer(recording, { type: "move", x: 210 });
    expect(moved.cancelReady).toBe(true);
    expect(
      voiceRecorderReducer({ ...moved, elapsedMs: 2_000 }, { type: "release", at: 3_150 }).hint,
    ).toBe("Voice note cancelled.");
  });

  it("discards a recording when a match starts before upload", () => {
    const recording = voiceRecorderReducer(pressed, { type: "threshold", at: 1_150 });
    const interrupted = voiceRecorderReducer(recording, {
      type: "interrupt",
      reason: "match_started",
    });
    expect(interrupted.phase).toBe("idle");
    expect(interrupted.hint).toContain("live play");
  });

  it("does not cancel an upload when a match starts", () => {
    const uploading = { ...initialVoiceRecorderState, phase: "uploading" as const };
    expect(voiceRecorderReducer(uploading, { type: "interrupt", reason: "match_started" })).toBe(
      uploading,
    );
  });

  it("discards on a forced disconnect", () => {
    const recording = voiceRecorderReducer(pressed, { type: "threshold", at: 1_150 });
    const interrupted = voiceRecorderReducer(recording, {
      type: "interrupt",
      reason: "forced_disconnect",
    });
    expect(interrupted.hint).toContain("Reconnect");
  });

  it("uses the proposed client and server byte limits", () => {
    expect(VOICE_CLIENT_TARGET_BYTES).toBe(150 * 1024);
    expect(VOICE_SERVER_MAX_BYTES).toBe(500 * 1024);
  });
});
