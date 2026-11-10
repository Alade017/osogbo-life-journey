// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  handleGroupMediaLink,
  handleGroupPictureUpload,
  handleGroupVoiceUpload,
} from "@/lib/social-group-media.server";

const groupId = "e1111111-1111-4111-8111-111111111111";
const requestId = "e2222222-2222-4222-8222-222222222222";
const messageId = "e3333333-3333-4333-8333-333333333333";

describe("group media endpoints", () => {
  it("rejects voice and picture uploads without a signed-in player", async () => {
    const form = new FormData();
    form.set("groupId", groupId);
    form.set("durationMs", "4000");
    form.set("file", new File([new Uint8Array(64)], "voice.ogg", { type: "audio/ogg" }));
    const voice = await handleGroupVoiceUpload(
      new Request("https://example.test/api/groups/voice/", {
        method: "POST",
        headers: { "Idempotency-Key": requestId },
        body: form,
      }),
    );
    expect(voice.status).toBe(401);

    const picture = await handleGroupPictureUpload(
      new Request("https://example.test/api/groups/media/", {
        method: "POST",
        headers: { "Idempotency-Key": requestId },
        body: new FormData(),
      }),
    );
    expect(picture.status).toBe(401);
  });

  it("does not sign links for players who are not signed in", async () => {
    const response = await handleGroupMediaLink(
      new Request(`https://example.test/api/groups/media/${messageId}`),
      messageId,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHORIZED" } });
  });
});
