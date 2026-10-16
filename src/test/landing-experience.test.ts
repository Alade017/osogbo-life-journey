import { describe, expect, it } from "vitest";
import { resolveLandingExperience } from "@/routes/index";

describe("landing experience", () => {
  it("keeps the page in a checking state while the session loads", () => {
    expect(resolveLandingExperience("checking", false)).toMatchObject({
      mode: "checking",
      primaryLabel: "Checking your save…",
    });
  });

  it("sends a signed-out new player to account creation", () => {
    expect(resolveLandingExperience("signed-out", false)).toEqual({
      mode: "new",
      primaryLink: "/signup",
      primaryLabel: "Start a new life",
    });
  });

  it("sends a signed-in player without a character to character creation", () => {
    expect(resolveLandingExperience("signed-in", false)).toEqual({
      mode: "new",
      primaryLink: "/create-character",
      primaryLabel: "Start a new life",
    });
  });

  it("returns an existing player to their saved life", () => {
    expect(resolveLandingExperience("signed-in", true)).toEqual({
      mode: "returning",
      primaryLink: "/enter",
      primaryLabel: "Continue your life",
    });
  });

  it("surfaces account and save lookup errors", () => {
    expect(resolveLandingExperience("error", false).mode).toBe("error");
    expect(resolveLandingExperience("signed-in", false, true).mode).toBe("error");
  });
});
