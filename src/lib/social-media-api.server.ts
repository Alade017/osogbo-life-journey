import { createHash } from "node:crypto";

const MAX = 10 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const failure = (code: string, status: number) => json({ error: { code } }, status);
type MediaInput = {
  purpose: "attachment" | "cover";
  threadId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  digest: string;
};
type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  upload: (
    userId: string,
    requestId: string,
    input: MediaInput,
    bytes: Uint8Array,
  ) => Promise<unknown>;
  download: (userId: string, messageId: string) => Promise<unknown>;
  profile: (userId: string, characterId: string) => Promise<unknown>;
  clearCover: (userId: string, characterId: string) => Promise<unknown>;
};
async function boundedForm(request: Request) {
  const limit = MAX + 65536;
  if (Number(request.headers.get("content-length")) > limit) throw new Error("MEDIA_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_MEDIA");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.length;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw new Error("MEDIA_TOO_LARGE");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: bytes,
  })
    .formData()
    .catch(() => {
      throw new Error("INVALID_MEDIA");
    });
}
export function mediaSignature(bytes: Uint8Array, mime: string) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (mime === "image/jpeg") return starts(255, 216, 255);
  if (mime === "image/png") return starts(137, 80, 78, 71, 13, 10, 26, 10);
  if (mime === "image/webp")
    return starts(82, 73, 70, 70) && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return mime === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}
export function createSocialMediaHandlers(deps: Dependencies) {
  async function read(request: Request, id: string, kind: "download" | "profile" | "clearCover") {
    const user = await deps.authenticate(request);
    if (!user) return failure("UNAUTHORIZED", 401);
    if (!uuid.test(id)) return failure("INVALID_ID", 400);
    try {
      return json(await deps[kind](user, id));
    } catch {
      return failure(kind === "profile" ? "PROFILE_UNAVAILABLE" : "MEDIA_UNAVAILABLE", 404);
    }
  }
  return {
    download: (request: Request, id: string) => read(request, id, "download"),
    profile: (request: Request, id: string) => read(request, id, "profile"),
    clearCover: (request: Request, id: string) => read(request, id, "clearCover"),
    upload: async (request: Request) => {
      const user = await deps.authenticate(request);
      if (!user) return failure("UNAUTHORIZED", 401);
      const key = request.headers.get("Idempotency-Key") ?? "";
      if (!uuid.test(key)) return failure("INVALID_IDEMPOTENCY_KEY", 400);
      try {
        const form = await boundedForm(request);
        const file = form.get("file"),
          purpose = form.get("purpose"),
          thread = form.get("threadId");
        if (
          !(file instanceof File) ||
          !file.size ||
          (purpose !== "attachment" && purpose !== "cover") ||
          (purpose === "attachment" && (typeof thread !== "string" || !uuid.test(thread))) ||
          (purpose === "cover" && thread !== null)
        )
          return failure("INVALID_MEDIA", 400);
        if (file.size > MAX) return failure("MEDIA_TOO_LARGE", 413);
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (
          (purpose === "cover" && file.type === "application/pdf") ||
          !mediaSignature(bytes, file.type)
        )
          return failure("UNSUPPORTED_MEDIA", 415);
        const filename =
          Array.from(file.name)
            .map((char) =>
              char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "/" || char === "\\"
                ? "_"
                : char,
            )
            .join("")
            .slice(0, 100) || "attachment";
        return json(
          await deps.upload(
            user,
            key,
            {
              purpose,
              threadId: typeof thread === "string" ? thread : null,
              filename,
              mimeType: file.type,
              size: file.size,
              digest: createHash("sha256").update(bytes).digest("hex"),
            },
            bytes,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "MEDIA_UPLOAD_FAILED";
        const code =
          [
            "MEDIA_TOO_LARGE",
            "UNKNOWN_THREAD",
            "IDEMPOTENCY_CONFLICT",
            "MEDIA_RATE_LIMIT",
            "MESSAGE_RATE_LIMIT",
            "MEDIA_UPLOAD_FAILED",
            "INVALID_MEDIA",
          ].find((code) => message.includes(code)) ?? "MEDIA_SERVICE_UNAVAILABLE";
        return failure(
          code,
          code === "INVALID_MEDIA"
            ? 400
            : code === "MEDIA_TOO_LARGE"
              ? 413
              : code.includes("RATE_LIMIT")
                ? 429
                : code === "UNKNOWN_THREAD"
                  ? 403
                  : code === "MEDIA_UPLOAD_FAILED" || code === "MEDIA_SERVICE_UNAVAILABLE"
                    ? 503
                    : 409,
        );
      }
    },
  };
}
export async function productionSocialMediaHandlers() {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const rpc = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const call = admin.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const result = await call(name, args);
    if (result.error) throw new Error(result.error.message);
    if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
      throw new Error("MEDIA_UNAVAILABLE");
    return result.data as Record<string, unknown>;
  };
  const sign = async (path: unknown, filename?: string) => {
    if (typeof path !== "string") throw new Error("MEDIA_UNAVAILABLE");
    const result = await admin.storage
      .from("social-media-v1")
      .createSignedUrl(path, 60, filename ? { download: filename } : undefined);
    if (result.error) throw new Error("MEDIA_UNAVAILABLE");
    return result.data.signedUrl;
  };
  return createSocialMediaHandlers({
    authenticate: async (request) => {
      const token = request.headers.get("authorization");
      if (!token?.startsWith("Bearer ")) return null;
      const { data, error } = await admin.auth.getUser(token.slice(7));
      return error ? null : (data.user?.id ?? null);
    },
    upload: async (user, key, input, bytes) => {
      const item = await rpc("prepare_social_media_as_user", {
        p_user_id: user,
        p_request_id: key,
        p_purpose: input.purpose,
        p_thread_id: input.threadId,
        p_filename: input.filename,
        p_mime_type: input.mimeType,
        p_size: input.size,
        p_digest: input.digest,
      });
      if (!item["completed"]) {
        if (typeof item["storage_path"] !== "string") throw new Error("MEDIA_UPLOAD_FAILED");
        const result = await admin.storage
          .from("social-media-v1")
          .upload(item["storage_path"], bytes, { contentType: input.mimeType, upsert: false });
        if (
          result.error &&
          !("statusCode" in result.error && String(result.error.statusCode) === "409")
        )
          throw new Error("MEDIA_UPLOAD_FAILED");
      }
      // Do not delete on an ambiguous final response: a committed receipt owns this object.
      return rpc("finish_social_media_as_user", { p_user_id: user, p_request_id: key });
    },
    download: async (user, id) => {
      const item = await rpc("get_social_media_as_user", { p_user_id: user, p_message_id: id });
      const url = await sign(
        item["path"],
        item["mimeType"] === "application/pdf" ? String(item["filename"]) : undefined,
      );
      return { url, filename: item["filename"], mimeType: item["mimeType"], size: item["size"] };
    },
    clearCover: (user, id) =>
      rpc("clear_social_profile_cover_as_user", { p_user_id: user, p_character_id: id }),
    profile: async (user, id) => {
      const item = await rpc("get_social_profile_card_as_user", {
        p_user_id: user,
        p_character_id: id,
      });
      const coverPath = item["coverPath"];
      return {
        characterId: item["characterId"],
        name: item["name"],
        gender: item["gender"],
        appearance: item["appearance"],
        level: item["level"],
        isOwn: item["isOwn"],
        isFriend: item["isFriend"],
        status: item["status"],
        coverUrl: coverPath ? await sign(coverPath) : null,
      };
    },
  });
}
