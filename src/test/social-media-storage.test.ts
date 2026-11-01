// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { productionSocialMediaHandlers } from "@/lib/social-media-api.server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), sign: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) },
    rpc: mocks.rpc,
    storage: {
      from: () => ({ upload: mocks.upload, createSignedUrl: mocks.sign, remove: mocks.remove }),
    },
  },
}));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://example.test/signed" }, error: null });
});
function request() {
  const form = new FormData();
  form.set("purpose", "attachment");
  form.set("threadId", id);
  form.set("file", new File(["%PDF-1.7"], "note.pdf", { type: "application/pdf" }));
  return new Request("https://example.test/api/messages/media/", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", "Idempotency-Key": id },
    body: form,
  });
}
it("never deletes a committed object's bytes after a lost finalization response", async () => {
  mocks.rpc
    .mockResolvedValueOnce({
      data: { completed: false, storage_path: "immutable/path.pdf" },
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: { message: "Response lost" } })
    .mockResolvedValueOnce({
      data: { completed: true, storage_path: "immutable/path.pdf" },
      error: null,
    })
    .mockResolvedValueOnce({ data: { ok: true, messageId: id, duplicate: true }, error: null });
  const handlers = await productionSocialMediaHandlers();
  expect((await handlers.upload(request())).status).toBe(503);
  expect((await handlers.upload(request())).status).toBe(200);
  expect(mocks.upload).toHaveBeenCalledOnce();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("signs PDFs for short-lived downloads after the access RPC succeeds", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: { path: "private/note.pdf", filename: "note.pdf", mimeType: "application/pdf", size: 8 },
    error: null,
  });
  const handlers = await productionSocialMediaHandlers();
  expect(
    (
      await handlers.download(
        new Request("https://example.test", { headers: { Authorization: "Bearer user-token" } }),
        id,
      )
    ).status,
  ).toBe(200);
  expect(mocks.sign).toHaveBeenCalledWith("private/note.pdf", 60, { download: "note.pdf" });
});
it("does not sign an object when its access check fails", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "MEDIA_NOT_FOUND" } });
  const handlers = await productionSocialMediaHandlers();
  expect(
    (
      await handlers.download(
        new Request("https://example.test", { headers: { Authorization: "Bearer user-token" } }),
        id,
      )
    ).status,
  ).toBe(404);
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("allowlists profile output even if a future RPC includes sensitive fields", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: {
      characterId: id,
      name: "Ayo",
      gender: "female",
      appearance: {},
      level: 4,
      isOwn: false,
      isFriend: true,
      status: null,
      coverPath: "private/cover.png",
      email: "private@example.test",
      wallet: 1234,
      current_location_id: "private",
    },
    error: null,
  });
  const handlers = await productionSocialMediaHandlers();
  const response = await handlers.profile(
    new Request("https://example.test", { headers: { Authorization: "Bearer user-token" } }),
    id,
  );
  const body = await response.json();
  expect(body.coverUrl).toBe("https://example.test/signed");
  expect(Object.keys(body).sort()).toEqual(
    [
      "characterId",
      "name",
      "gender",
      "appearance",
      "level",
      "isOwn",
      "isFriend",
      "status",
      "coverUrl",
    ].sort(),
  );
});
