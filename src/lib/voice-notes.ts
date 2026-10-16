import { supabase } from "@/integrations/supabase/client";
import { VOICE_CLIENT_TARGET_BYTES, VOICE_SERVER_MAX_BYTES } from "@/lib/voice-recorder-state";

export function supportedVoiceMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/ogg", "audio/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? null
  );
}

export async function prepareVoiceUpload(blob: Blob, reencode: (source: Blob) => Promise<Blob>) {
  const prepared = blob.size > VOICE_CLIENT_TARGET_BYTES ? await reencode(blob) : blob;
  if (prepared.size > VOICE_SERVER_MAX_BYTES) throw new Error("VOICE_NOTE_TOO_LARGE");
  return prepared;
}

/** Rare fallback for container overhead above 150 KB. It holds one decoded buffer and releases it. */
export async function reencodeVoiceNote(source: Blob): Promise<Blob> {
  const mimeType = supportedVoiceMimeType();
  const AudioContextType = window.AudioContext;
  if (!mimeType || !AudioContextType) return source;
  const context = new AudioContextType();
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer());
    const destination = context.createMediaStreamDestination();
    const player = context.createBufferSource();
    player.buffer = decoded;
    player.connect(destination);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 12_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const completed = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      player.onended = () => recorder.stop();
    });
    recorder.start(250);
    player.start();
    await completed;
    player.disconnect();
    return new Blob(chunks, { type: mimeType });
  } catch {
    return source;
  } finally {
    await context.close();
  }
}

async function token() {
  const { data } = await supabase.auth.getSession();
  const value = data.session?.access_token;
  if (!value) throw new Error("Sign in to send voice notes.");
  return value;
}

export async function uploadVoiceNote(input: {
  threadId: string;
  blob: Blob;
  durationMs: number;
  requestId: string;
}) {
  let lastError = new Error("VOICE_UPLOAD_FAILED");
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    const form = new FormData();
    form.set("threadId", input.threadId);
    form.set("durationMs", String(input.durationMs));
    form.set("file", input.blob, "voice-note.ogg");
    try {
      const result = await fetch("/api/messages/voice/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Idempotency-Key": input.requestId,
        },
        body: form,
      });
      const body = (await result.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (result.ok) return body;
      lastError = new Error(body?.error?.code ?? "VOICE_UPLOAD_FAILED");
      if (result.status < 500 && result.status !== 408 && result.status !== 429) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : lastError;
      if (!(error instanceof TypeError) && lastError.message !== "VOICE_UPLOAD_FAILED")
        throw lastError;
    }
  }
  throw lastError;
}

export async function getVoiceNoteUrl(messageId: string) {
  const result = await fetch(`/api/messages/voice/${messageId}`, {
    headers: { Authorization: `Bearer ${await token()}` },
  });
  const body = (await result.json().catch(() => null)) as { url?: unknown } | null;
  if (!result.ok || typeof body?.url !== "string")
    throw new Error("Voice note could not be loaded.");
  return body.url;
}
