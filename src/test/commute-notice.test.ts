import { describe, expect, it } from "vitest";
import { commuteNotice } from "../game/commute-notice.ts";

describe("commuteNotice", () => {
  it("shows the banner and beacon when the commute starts", () => {
    expect(commuteNotice({ status: "started" })).toEqual({
      heading: true,
      openWork: false,
      toast: { kind: "message", text: "Heading to work" },
    });
  });

  it("opens the work panel on arrival", () => {
    const notice = commuteNotice({ status: "ended", reason: "arrived" });
    expect(notice?.heading).toBe(false);
    expect(notice?.openWork).toBe(true);
  });

  it("clears the banner without opening work when cancelled or blocked", () => {
    expect(commuteNotice({ status: "ended", reason: "cancelled" })).toMatchObject({
      heading: false,
      openWork: false,
    });
    expect(commuteNotice({ status: "ended", reason: "blocked" })).toMatchObject({
      heading: false,
      openWork: false,
      toast: { kind: "error" },
    });
  });

  it("shows the server's refusal reason as an error", () => {
    expect(
      commuteNotice({ status: "refused", reason: "Your shift is in a different neighbourhood." }),
    ).toEqual({
      heading: false,
      openWork: false,
      toast: { kind: "error", text: "Your shift is in a different neighbourhood." },
    });
  });

  it("ignores unexpected messages", () => {
    expect(commuteNotice(null)).toBeNull();
    expect(commuteNotice({ status: "ended", reason: "teleported" })).toBeNull();
    expect(commuteNotice({ status: "unknown" })).toBeNull();
  });
});
