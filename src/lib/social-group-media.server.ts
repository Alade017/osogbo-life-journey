import { acceptedTypes as acceptedVoiceTypes } from "@/lib/voice-note-api.server";
import { mediaSignature } from "@/lib/social-media-api.server";
import { MEDIA_MAX_BYTES } from "@/lib/social-media";
import { VOICE_SERVER_MAX_BYTES } from "@/lib/voice-recorder-state";

/** Voice notes and pictures for group chats. The file is stored first, then the database checks
 *  membership, the path and the duration. A failed record removes the stored file. */

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VOICE_BUCKET = "social-voice-notes";
const PICTURE_BUCKET = "social-media-v1";
const SIGNED_LINK_SECONDS = 300;
const pictureExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const failure = (code: string, status: number) => json({ error: { code } }, status);

async function authenticatedUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
}

/** The database error text carries the stable code, e.g. "NOT_IN_GROUP". */
function codeFrom(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? fallback;
}

/** Strip the storage path before a record leaves the server. */
function publicRecord(record: unknown) {
  if (!record || typeof record !== "object") return record;
  const { media_path: _path, ...rest } = record as Record<string, unknown>;
  return rest;
}

async function recordMedia(
  userId: string,
  groupId: string,
  kind: "voice" | "image",
  path: string,
  bucket: string,
  bytes: ArrayBuffer,
  contentType: string,
  durationMs: number | null,
  requestId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: true });
  if (uploadError) throw new Error("MEDIA_UPLOAD_FAILED");
  try {
    const { data, error } = await supabaseAdmin.rpc("send_social_group_media_as_user", {
      p_user_id: userId,
      p_group_id: groupId,
      p_kind: kind,
      p_path: path,
      p_duration_ms: durationMs,
      p_request_id: requestId,
    });
    if (error) throw new Error(error.message);
    return publicRecord(data);
  } catch (error) {
    await supabaseAdmin.storage.from(bucket).remove([path]);
    throw error;
  }
}

export async function handleGroupVoiceUpload(request: Request) {
  const userId = await authenticatedUser(request);
  if (!userId) return failure("UNAUTHORIZED", 401);
  const requestId = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!uuidPattern.test(requestId)) return failure("INVALID_IDEMPOTENCY_KEY", 400);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const groupId = form?.get("groupId");
  const durationMs = Number(form?.get("durationMs"));
  if (!(file instanceof File) || !file.size) return failure("VOICE_REQUIRED", 400);
  if (typeof groupId !== "string" || !uuidPattern.test(groupId))
    return failure("INVALID_GROUP", 400);
  if (file.size > VOICE_SERVER_MAX_BYTES) return failure("VOICE_TOO_LARGE", 413);
  if (!acceptedVoiceTypes.has(file.type)) return failure("UNSUPPORTED_MEDIA", 415);
  if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 60_000)
    return failure("VOICE_DURATION_INVALID", 400);
  try {
    const path = `group/${groupId}/${requestId}.ogg`;
    return json(
      await recordMedia(
        userId,
        groupId,
        "voice",
        path,
        VOICE_BUCKET,
        await file.arrayBuffer(),
        file.type,
        durationMs,
        requestId,
      ),
    );
  } catch (error) {
    return failure(codeFrom(error, "VOICE_UPLOAD_FAILED"), 400);
  }
}

export async function handleGroupPictureUpload(request: Request) {
  const userId = await authenticatedUser(request);
  if (!userId) return failure("UNAUTHORIZED", 401);
  const requestId = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!uuidPattern.test(requestId)) return failure("INVALID_IDEMPOTENCY_KEY", 400);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const groupId = form?.get("groupId");
  if (!(file instanceof File) || !file.size) return failure("MEDIA_REQUIRED", 400);
  if (typeof groupId !== "string" || !uuidPattern.test(groupId))
    return failure("INVALID_GROUP", 400);
  if (file.size > MEDIA_MAX_BYTES) return failure("MEDIA_TOO_LARGE", 413);
  const extension = pictureExtensions[file.type];
  if (!extension) return failure("UNSUPPORTED_MEDIA", 415);
  const bytes = await file.arrayBuffer();
  if (!mediaSignature(new Uint8Array(bytes), file.type)) return failure("UNSUPPORTED_MEDIA", 415);
  try {
    const path = `group/${groupId}/${requestId}.${extension}`;
    return json(
      await recordMedia(
        userId,
        groupId,
        "image",
        path,
        PICTURE_BUCKET,
        bytes,
        file.type,
        null,
        requestId,
      ),
    );
  } catch (error) {
    return failure(codeFrom(error, "MEDIA_UPLOAD_FAILED"), 400);
  }
}

export async function handleGroupMediaLink(request: Request, messageId: string) {
  const userId = await authenticatedUser(request);
  if (!userId) return failure("UNAUTHORIZED", 401);
  if (!uuidPattern.test(messageId)) return failure("MEDIA_NOT_FOUND", 404);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_social_group_media_as_user", {
    p_user_id: userId,
    p_message_id: messageId,
  });
  if (error || !data || typeof data !== "object") {
    return failure(codeFrom(error, "MEDIA_NOT_FOUND"), 404);
  }
  const { kind, path } = data as { kind: unknown; path: unknown };
  if (typeof path !== "string" || (kind !== "voice" && kind !== "image")) {
    return failure("MEDIA_NOT_FOUND", 404);
  }
  const bucket = kind === "voice" ? VOICE_BUCKET : PICTURE_BUCKET;
  const signed = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_LINK_SECONDS);
  if (signed.error) return failure("MEDIA_UNAVAILABLE", 503);
  return json({ url: signed.data.signedUrl, kind });
}
