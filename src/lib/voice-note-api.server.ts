import { VOICE_SERVER_MAX_BYTES } from "@/lib/voice-recorder-state";

type UploadDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  upload: (
    userId: string,
    threadId: string,
    file: File,
    durationMs: number,
    requestId: string,
  ) => Promise<unknown>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const acceptedTypes = new Set([
  "audio/ogg",
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
]);
const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function createVoiceUploadHandler(dependencies: UploadDependencies) {
  return async (request: Request) => {
    const userId = await dependencies.authenticate(request);
    if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
    const requestId = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!uuidPattern.test(requestId))
      return response({ error: { code: "INVALID_IDEMPOTENCY_KEY" } }, 400);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const threadId = form?.get("threadId");
    const durationMs = Number(form?.get("durationMs"));
    if (!(file instanceof File) || typeof threadId !== "string" || !uuidPattern.test(threadId))
      return response({ error: { code: "INVALID_VOICE_NOTE" } }, 400);
    if (!acceptedTypes.has(file.type))
      return response({ error: { code: "UNSUPPORTED_AUDIO" } }, 415);
    if (file.size > VOICE_SERVER_MAX_BYTES)
      return response({ error: { code: "VOICE_NOTE_TOO_LARGE" } }, 413);
    if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 60_000)
      return response({ error: { code: "INVALID_VOICE_DURATION" } }, 400);
    try {
      return response(await dependencies.upload(userId, threadId, file, durationMs, requestId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "VOICE_UPLOAD_FAILED";
      const code = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "VOICE_UPLOAD_FAILED";
      return response({ error: { code } }, code === "UNKNOWN_THREAD" ? 404 : 409);
    }
  };
}

async function authenticatedUser(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
}

export async function handleVoiceUploadRequest(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createVoiceUploadHandler({
    authenticate: authenticatedUser,
    upload: async (userId, threadId, file, durationMs, requestId) => {
      const path = `voice/${threadId}/${requestId}.ogg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("social-voice-notes")
        .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
      if (uploadError) throw new Error("VOICE_UPLOAD_FAILED");
      try {
        const { data, error } = await supabaseAdmin.rpc("create_voice_message_as_user", {
          p_user_id: userId,
          p_thread_id: threadId,
          p_path: path,
          p_duration_ms: durationMs,
          p_request_id: requestId,
        });
        if (error) throw new Error(error.message);
        const result = data as { delivered?: boolean } | null;
        if (result?.delivered === false)
          await supabaseAdmin.storage.from("social-voice-notes").remove([path]);
        return data;
      } catch (error) {
        await supabaseAdmin.storage.from("social-voice-notes").remove([path]);
        throw error;
      }
    },
  })(request);
}

export async function handleVoiceDownloadRequest(request: Request, messageId: string) {
  const userId = await authenticatedUser(request);
  if (!userId) return response({ error: { code: "UNAUTHORIZED" } }, 401);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_voice_note_as_user", {
    p_user_id: userId,
    p_message_id: messageId,
  });
  if (error || !data) return response({ error: { code: "VOICE_NOTE_NOT_FOUND" } }, 404);
  const path = (data as { path?: unknown }).path;
  if (typeof path !== "string") return response({ error: { code: "VOICE_NOTE_NOT_FOUND" } }, 404);
  const signed = await supabaseAdmin.storage.from("social-voice-notes").createSignedUrl(path, 300);
  if (signed.error) return response({ error: { code: "VOICE_NOTE_NOT_FOUND" } }, 404);
  return response({ url: signed.data.signedUrl });
}

export async function handleVoiceCleanupRequest(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return response({ error: { code: "UNAUTHORIZED" } }, 401);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("list_expired_voice_notes");
  if (error) return response({ error: { code: "VOICE_CLEANUP_FAILED" } }, 500);
  const candidates = Array.isArray(data)
    ? data.filter(
        (item): item is { message_id: string; path: string } =>
          !!item &&
          typeof item === "object" &&
          typeof (item as { message_id?: unknown }).message_id === "string" &&
          typeof (item as { path?: unknown }).path === "string",
      )
    : [];
  if (!candidates.length) return response({ removed: 0 });
  const removedStorage = await supabaseAdmin.storage
    .from("social-voice-notes")
    .remove(candidates.map((item) => item.path));
  if (removedStorage.error)
    return response({ error: { code: "VOICE_STORAGE_CLEANUP_FAILED" } }, 500);
  const finalized = await supabaseAdmin.rpc("finalize_expired_voice_notes", {
    p_message_ids: candidates.map((item) => item.message_id),
  });
  if (finalized.error) return response({ error: { code: "VOICE_CLEANUP_FAILED" } }, 500);
  return response({ removed: Number(finalized.data ?? 0) });
}
