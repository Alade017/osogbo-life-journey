// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createSocialMediaHandlers } from "@/lib/social-media-api.server";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
function setup(user: string | null = "server-user") {
  const deps = {
    authenticate: vi.fn(async () => user),
    upload: vi.fn(async () => ({ ok: true })),
    download: vi.fn(async () => ({ url: "signed" })),
    profile: vi.fn(async () => ({ name: "Ade" })),
    clearCover: vi.fn(async () => ({ ok: true })),
  };
  return { deps, handlers: createSocialMediaHandlers(deps) };
}
function upload(
  file = new File([png], "photo.png", { type: "image/png" }),
  purpose = "attachment",
) {
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", purpose);
  form.set("userId", "forged");
  if (purpose === "attachment") form.set("threadId", id);
  return new Request("https://example.test/api/messages/media/", {
    method: "POST",
    headers: { "Idempotency-Key": id },
    body: form,
  });
}
it("authenticates before reading uploads and ignores forged user IDs", async () => {
  const denied = setup(null);
  expect((await denied.handlers.upload(upload())).status).toBe(401);
  expect(denied.deps.upload).not.toHaveBeenCalled();
  const { deps, handlers } = setup();
  expect((await handlers.upload(upload())).status).toBe(200);
  expect(deps.upload).toHaveBeenCalledWith(
    "server-user",
    id,
    expect.objectContaining({
      purpose: "attachment",
      threadId: id,
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }),
    expect.any(Uint8Array),
  );
});
it("rejects spoofed content types, unsafe formats and PDF covers", async () => {
  const { handlers, deps } = setup();
  expect(
    (
      await handlers.upload(
        upload(new File(["<script>bad</script>"], "photo.png", { type: "image/png" })),
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await handlers.upload(
        upload(new File(["%PDF-1.7"], "document.pdf", { type: "application/pdf" }), "cover"),
      )
    ).status,
  ).toBe(415);
  expect(deps.upload).not.toHaveBeenCalled();
});
it("bounds streamed and declared request bodies before multipart parsing", async () => {
  const { handlers, deps } = setup();
  const tooBig = new Request("https://example.test/api/messages/media/", {
    method: "POST",
    headers: { "Idempotency-Key": id, "content-length": "20000000" },
    body: "x",
  });
  expect((await handlers.upload(tooBig)).status).toBe(413);
  const streamed = new Request("https://example.test/api/messages/media/", {
    method: "POST",
    headers: { "Idempotency-Key": id },
    body: new Uint8Array(10 * 1024 * 1024 + 65537),
  });
  expect((await handlers.upload(streamed)).status).toBe(413);
  expect(deps.upload).not.toHaveBeenCalled();
});
it("returns a useful retry status for thread rejection and rate limits", async () => {
  const { handlers, deps } = setup();
  deps.upload.mockRejectedValueOnce(new Error("UNKNOWN_THREAD"));
  expect((await handlers.upload(upload())).status).toBe(403);
  deps.upload.mockRejectedValueOnce(new Error("MESSAGE_RATE_LIMIT"));
  expect((await handlers.upload(upload())).status).toBe(429);
});
it("authenticates profile/download reads and validates their identifiers", async () => {
  const { handlers, deps } = setup();
  expect((await handlers.download(new Request("https://example.test"), "../other")).status).toBe(
    400,
  );
  expect(deps.download).not.toHaveBeenCalled();
  expect((await handlers.profile(new Request("https://example.test"), id)).status).toBe(200);
  expect(deps.profile).toHaveBeenCalledWith("server-user", id);
});
