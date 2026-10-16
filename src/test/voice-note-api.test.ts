import { describe, expect, it, vi } from "vitest";
import { createVoiceUploadHandler } from "@/lib/voice-note-api.server";
import { prepareVoiceUpload } from "@/lib/voice-notes";

const id = "14e9343d-f925-44d3-8df5-6f57ec80aa02";

function uploadRequest(size: number) {
  const form = new FormData();
  form.set("threadId", id);
  form.set("durationMs", "2000");
  form.set("file", new File([new Uint8Array(size)], "voice.ogg", { type: "audio/ogg" }));
  return {
    headers: new Headers({ "Idempotency-Key": id }),
    formData: async () => form,
  } as unknown as Request;
}

describe("voice note upload", () => {
  it("uses the re-encode path above 150 KB", async () => {
    const smaller = new Blob([new Uint8Array(140 * 1024)], { type: "audio/ogg" });
    const reencode = vi.fn().mockResolvedValue(smaller);
    const result = await prepareVoiceUpload(
      new Blob([new Uint8Array(151 * 1024)], { type: "audio/ogg" }),
      reencode,
    );
    expect(reencode).toHaveBeenCalledOnce();
    expect(result).toBe(smaller);
  });

  it("rejects files above 500 KB before upload", async () => {
    const upload = vi.fn();
    const handler = createVoiceUploadHandler({ authenticate: async () => "user-1", upload });
    const result = await handler(uploadRequest(500 * 1024 + 1));
    expect(result.status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });

  it("accepts a blocked-recipient result without exposing delivery", async () => {
    const upload = vi.fn().mockResolvedValue({ accepted: true, delivered: false });
    const handler = createVoiceUploadHandler({ authenticate: async () => "user-1", upload });
    const result = await handler(uploadRequest(20 * 1024));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ accepted: true, delivered: false });
  });
});
