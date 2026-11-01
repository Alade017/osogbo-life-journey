import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { socialMediaRequest, uploadSocialMedia } from "@/lib/social-media";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: auth } } }));
const session = (id: string) => ({ data: { session: { access_token: "token", user: { id } } } });
beforeEach(() => {
  auth.mockReset();
  auth.mockResolvedValue(session("owner"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("rejects a late result after switching accounts", async () => {
  auth.mockResolvedValueOnce(session("owner")).mockResolvedValueOnce(session("other"));
  await expect(socialMediaRequest("/api/social/profile/id")).rejects.toThrow("account changed");
});
it("uses the supplied receipt and does not retry a lost upload response automatically", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network unavailable"));
  const file = new File(["%PDF-1.7"], "note.pdf", { type: "application/pdf" });
  await expect(uploadSocialMedia(file, "stable-request", "thread")).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(
    "/api/messages/media/",
    expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "stable-request" }),
    }),
  );
});
it("shows a readable rate-limit error rather than a server code", async () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: { code: "MESSAGE_RATE_LIMIT" } }),
  } as Response);
  await expect(socialMediaRequest("/api/messages/media/")).rejects.toThrow("Wait a moment");
});
